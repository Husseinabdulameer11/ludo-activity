/**
 * LudoRoom.ts — Colyseus room. One instance = one active game session.
 * Manages turn flow, dice rolling, AI scheduling, and state broadcasting.
 */

import { Room, Client } from "colyseus";
import {
  LudoGameState,
  ClientMessage,
  ServerMessage,
  GameEvent,
  Player,
  PlayerColor,
  PLAYER_COLORS,
  createInitialState,
  getValidMoves,
  applyMove,
  advanceTurn,
  isGameOver,
  MoveCandidate,
} from "@ludo/shared";
import { LudoAI, createAIPlayer } from "../ai/LudoAI";

const MAX_PLAYERS = 4;
const DICE_SIDES = 6;
const THREE_SIXES_FORFEIT = 3;

interface SessionPlayer {
  client?: Client;           // undefined for AI
  player: Player;
  ai?: LudoAI;
}

export class LudoRoom extends Room<LudoGameState> {
  private sessions: SessionPlayer[] = [];
  private aiTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

 onCreate(options: { hostId?: string }) {
  this.maxClients = MAX_PLAYERS;
  // Remove the this.setState({}) line entirely

  this.onMessage("READY", (client, _msg) => {
    if (this.sessions.length > 0 && client.sessionId === this.sessions[0].client?.sessionId) {
      this.startGame();
    }
  });

  this.onMessage("ROLL_DICE", (client, _msg) => {
    this.handleRollDice(client);
  });

  this.onMessage("MOVE_PIECE", (client, msg: { pieceId: string }) => {
    this.handleMovePiece(client, msg.pieceId);
  });
}

  onJoin(client: Client, options: { displayName?: string; discordUserId?: string }) {
    if (this.sessions.length >= MAX_PLAYERS) {
      throw new Error("Room is full");
    }

    const colorIndex = this.sessions.length;
    const color = PLAYER_COLORS[colorIndex];

    const player: Player = {
      id: options.discordUserId ?? client.sessionId,
      color,
      type: "human",
      displayName: options.displayName ?? `Player ${colorIndex + 1}`,
      finished: false,
    };

    this.sessions.push({ client, player });
    this.broadcastLobby();
  }

  onLeave(client: Client, _consented: boolean) {
    // Replace departed human with AI so game can continue
    const idx = this.sessions.findIndex((s) => s.client?.sessionId === client.sessionId);
    if (idx === -1) return;
    // If game hasn't started yet, just remove the session and update lobby
    if (!this.state || this.state.phase === "waiting" as any) {
      this.sessions.splice(idx, 1);
      this.broadcastLobby();
      return;
    }

    const departed = this.sessions[idx];
    const aiData = createAIPlayer(departed.player.color);
    this.sessions[idx] = {
      player: {
        ...departed.player,
        type: "ai",
        personality: aiData.personality,
        displayName: `${aiData.displayName} (was ${departed.player.displayName})`,
      },
      ai: aiData.ai,
    };

    this.broadcast("EVENT", {
      type: "EVENT",
      event: { type: "TURN_CHANGED", playerId: this.sessions[idx].player.id },
    } satisfies ServerMessage);

    // If it was this player's turn, schedule AI
    if (this.state.players?.[this.state.currentPlayerIndex]?.id === departed.player.id) {
      this.scheduleAITurn();
    }
  }

  // ─── Game Start ─────────────────────────────────────────────────────────────

  private startGame() {
    this.fillWithAI();

    const players = this.sessions.map((s) => s.player);
    const gameState = createInitialState(this.roomId, players);
    this.setState(gameState);

    this.broadcastState();

    // If first player is AI, kick them off
    if (this.sessions[0].ai) {
      this.scheduleAITurn();
    }
  }

  private fillWithAI() {
    while (this.sessions.length < MAX_PLAYERS) {
      const colorIndex = this.sessions.length;
      const color = PLAYER_COLORS[colorIndex];
      const aiData = createAIPlayer(color);

      this.sessions.push({
        player: {
          id: aiData.id,
          color,
          type: "ai",
          personality: aiData.personality,
          displayName: aiData.displayName,
          finished: false,
        },
        ai: aiData.ai,
      });
    }
  }

  // ─── Human Actions ───────────────────────────────────────────────────────────

  private handleRollDice(client: Client) {
    const session = this.sessions.find((s) => s.client?.sessionId === client.sessionId);
    if (!session) return;
    if (this.state.phase !== "rolling") return;
    if (!this.isCurrentPlayer(session.player.id)) return;

    const result = this.rollDice();
    if (result.forfeited || !result.hasValidMoves) {
      // No moves available — advance after a short pause so the player sees the roll
      setTimeout(() => this.advanceToNextTurn(), 1200);
    }
  }

  private handleMovePiece(client: Client, pieceId: string) {
    const session = this.sessions.find((s) => s.client?.sessionId === client.sessionId);
    if (!session) return;
    if (this.state.phase !== "moving") return;
    if (!this.isCurrentPlayer(session.player.id)) return;

    const diceValue = this.state.dice!.value;
    const validMoves = getValidMoves(this.state, diceValue);
    const move = validMoves.find((m) => m.pieceId === pieceId);

    if (!move) {
      client.send("ERROR", { type: "ERROR", message: "Invalid move" });
      return;
    }

    this.executeMove(move);
  }

  // ─── AI Scheduling ───────────────────────────────────────────────────────────

  private scheduleAITurn() {
    const current = this.sessions[this.state.currentPlayerIndex];
    if (!current?.ai) return;

    // AI roll delay (feels like they're "thinking" before rolling)
    const rollDelay = 800 + Math.random() * 600;
    const timerId = setTimeout(() => {
      this.aiRoll(current);
    }, rollDelay);

    this.aiTimers.set(current.player.id, timerId);
  }

  private aiRoll(session: SessionPlayer) {
    if (!session.ai) return;
    const result = this.rollDice();

    if (result.forfeited || !result.hasValidMoves) {
      // No moves — advance turn after pause (same delay as human path)
      setTimeout(() => this.advanceToNextTurn(), 1200);
      return;
    }

    // Use the value returned by rollDice (not this.state.dice, which may not
    // have updated synchronously in all Colyseus versions)
    const diceValue = result.value;
    const validMoves = getValidMoves(this.state, diceValue);

    const decision = session.ai.decide(this.state, diceValue);
    if (!decision) {
      setTimeout(() => this.advanceToNextTurn(), 600);
      return;
    }

    const timerId = setTimeout(() => {
      this.executeMove(decision.move);
    }, decision.thinkingMs);

    this.aiTimers.set(session.player.id, timerId);
  }

  // ─── Core Turn Logic ─────────────────────────────────────────────────────────

  private rollDice(): { value: number; hasValidMoves: boolean; forfeited: boolean } {
    const value = Math.floor(Math.random() * DICE_SIDES) + 1;
    const consecutiveSixes =
      value === 6 ? this.state.consecutiveSixes + 1 : 0;

    // Three sixes in a row → forfeit turn
    if (consecutiveSixes >= THREE_SIXES_FORFEIT) {
      const currentPlayer = this.state.players[this.state.currentPlayerIndex];
      this.emitEvent({ type: "FORFEITED_TURN", playerId: currentPlayer.id, reason: "three_sixes" });
      // Use a local snapshot so setState is not needed just to compute new state
      const newState = {
        ...this.state,
        dice: { value, rolledAt: Date.now() },
        consecutiveSixes,
        phase: "rolling" as const,
      };
      this.setState(newState);
      this.broadcastState();
      // Caller handles advancing after forfeit
      return { value, hasValidMoves: false, forfeited: true };
    }

    const diceSnapshot = { value, rolledAt: Date.now() };
    const validMoves = getValidMoves(
      { ...this.state, dice: diceSnapshot },
      value
    );
    const hasValidMoves = validMoves.length > 0;
    const phase = hasValidMoves ? "moving" : "rolling";

    const newState = {
      ...this.state,
      dice: diceSnapshot,
      consecutiveSixes,
      phase: phase as "moving" | "rolling",
    };
    this.setState(newState);

    const currentPlayer = newState.players[newState.currentPlayerIndex];
    this.emitEvent({ type: "DICE_ROLLED", playerId: currentPlayer.id, value });

    this.broadcastState();
    // Caller is responsible for advancing the turn when hasValidMoves is false
    return { value, hasValidMoves, forfeited: false };
  }

  private executeMove(move: MoveCandidate) {
    let newState = applyMove(this.state, move);

    // Emit move event
    this.emitEvent({ type: "PIECE_MOVED", pieceId: move.pieceId, from: move.from, to: move.to });

    if (move.capturesId) {
      this.emitEvent({ type: "PIECE_CAPTURED", capturedPieceId: move.capturesId, byPieceId: move.pieceId });
    }

    if (move.isFinishing) {
      const piece = this.state.pieces.find((p) => p.id === move.pieceId)!;
      const player = this.state.players.find((p) => p.color === piece.color)!;
      const rank = newState.rankings.length;
      this.emitEvent({ type: "PIECE_FINISHED", pieceId: move.pieceId, playerId: player.id, rank });

      const playerFinished = newState.players.find((p) => p.id === player.id)?.finished ?? false;
      if (playerFinished) {
        this.emitEvent({ type: "PLAYER_FINISHED", playerId: player.id, rank });
      }
    }

    this.setState(newState);

    if (isGameOver(newState)) {
      this.setState({ ...this.state, phase: "finished" });
      this.broadcastState();
      return;
    }

    // Bonus turn on 6 or capture
    const getsBonus = this.state.dice?.value === 6 || !!move.capturesId;
    if (getsBonus) {
      const currentPlayer = this.state.players[this.state.currentPlayerIndex];
      const reason = this.state.dice?.value === 6 ? "six" : "capture";
      this.emitEvent({ type: "BONUS_TURN", playerId: currentPlayer.id, reason });
      this.setState({ ...this.state, dice: null, phase: "rolling" });
      this.broadcastState();

      const current = this.sessions[this.state.currentPlayerIndex];
      if (current.ai) {
        setTimeout(() => this.scheduleAITurn(), 500);
      }
      return;
    }

    this.advanceToNextTurn();
  }

  private advanceToNextTurn() {
    const newState = advanceTurn(this.state);
    this.setState(newState);
    this.broadcastState();

    const nextSession = this.sessions[newState.currentPlayerIndex];
    this.emitEvent({ type: "TURN_CHANGED", playerId: nextSession.player.id });

    if (nextSession.ai) {
      this.scheduleAITurn();
    }
  }

  private endTurn(getsBonus: boolean) {
    if (getsBonus) {
      this.setState({ ...this.state, dice: null, phase: "rolling" });
      this.broadcastState();
      const current = this.sessions[this.state.currentPlayerIndex];
      if (current.ai) setTimeout(() => this.scheduleAITurn(), 500);
    } else {
      this.advanceToNextTurn();
    }
  }

  // ─── Utilities ───────────────────────────────────────────────────────────────

  private isCurrentPlayer(playerId: string): boolean {
    return this.state.players?.[this.state.currentPlayerIndex]?.id === playerId;
  }

  private emitEvent(event: GameEvent) {
    this.setState({ ...this.state, lastEvent: event });
    this.broadcast("EVENT", { type: "EVENT", event } satisfies ServerMessage);
  }

  private broadcastLobby() {
    // Sent before the game starts so the lobby can show who has joined
    this.broadcast("LOBBY_UPDATE", {
      players: this.sessions.map((s) => ({
        id: s.player.id,
        displayName: s.player.displayName,
        color: s.player.color,
      })),
    });
  }

  private broadcastState() {
    this.broadcast("STATE_UPDATE", {
      type: "STATE_UPDATE",
      state: this.state,
    } satisfies ServerMessage);
  }

  onDispose() {
    for (const timer of this.aiTimers.values()) clearTimeout(timer);
  }
}
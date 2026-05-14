/**
 * GameScene.ts — Main Phaser scene. Renders the Ludo board and handles
 * all game state updates from the server.
 */

import Phaser from "phaser";
import {
  LudoGameState,
  ServerMessage,
  GameEvent,
  PlayerColor,
  getValidMoves,
} from "@ludo/shared";
import { drawBoard, BOARD_PX, COLOR_HEX } from "../game/Board";
import { PieceSprite } from "../game/Piece";
import { DiceSprite } from "../game/Dice";
import { sendMessage, onStateUpdate, onEvent } from "../game/Connection";

export interface GameSceneData {
  myPlayerId: string;
  initialState: LudoGameState;
}

export class GameScene extends Phaser.Scene {
  private myPlayerId!: string;
  private gameState!: LudoGameState;
  private pieceSprites: Map<string, PieceSprite> = new Map();
  private diceSprite!: DiceSprite;
  private statusText!: Phaser.GameObjects.Text;
  private turnIndicator!: Phaser.GameObjects.Text;
  private debugText!: Phaser.GameObjects.Text;
  private boardX: number = 0;
  private boardY: number = 0;

  constructor() {
    super({ key: "GameScene" });
  }

  init(data: GameSceneData) {
    this.myPlayerId = data.myPlayerId;
    this.gameState = data.initialState;

    // Debug: log the ID we received and all player IDs in initial state
    console.log("[GameScene] myPlayerId:", this.myPlayerId);
    console.log("[GameScene] initialState players:", data.initialState?.players?.map(p => p.id));
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    const boardX = (W - BOARD_PX) / 2;
    const boardY = 80;
    this.boardX = boardX;
    this.boardY = boardY;

    const boardGraphics = drawBoard(this);
    boardGraphics.setPosition(boardX, boardY);

    this.turnIndicator = this.add
      .text(W / 2, 30, "", {
        fontSize: "16px",
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(W / 2, 55, "", {
        fontSize: "13px",
        color: "#aaaacc",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    // Temporary debug text — remove once working
    this.debugText = this.add
      .text(W / 2, 68, "", {
        fontSize: "10px",
        color: "#ff6666",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    const diceY = boardY + BOARD_PX + 50;
    this.diceSprite = new DiceSprite(this, W / 2, diceY, () => {
      sendMessage({ type: "ROLL_DICE" });
    });

    this.drawPlayerBadges(boardX, diceY + 50);
    this.createPieceSprites(boardX, boardY);

    this.unsubState = onStateUpdate((state) => {
      this.gameState = state;
      this.syncUI();
    });

    this.unsubEvent = onEvent((msg: ServerMessage) => {
      console.log("[GameScene] raw event msg:", msg);
      if (msg.type === "EVENT") this.handleEvent(msg.event);
    });

    this.syncUI();
  }

  private resolveMyPlayerId(state: LudoGameState): string {
    // Check if our stored ID directly matches a player
    if (state.players?.some(p => p.id === this.myPlayerId)) {
      return this.myPlayerId;
    }

    // Fallback: in dev/single-player mode we are always the first human player
    const firstHuman = state.players?.find(p => p.type === "human");
    if (firstHuman) {
      console.warn("[GameScene] myPlayerId", this.myPlayerId, "not found in state — falling back to first human:", firstHuman.id);
      this.myPlayerId = firstHuman.id; // correct it for future calls
      return firstHuman.id;
    }

    return this.myPlayerId;
  }

  private createPieceSprites(boardX: number, boardY: number) {
    this.pieceSprites.forEach((s) => s.destroy());
    this.pieceSprites.clear();

    for (const piece of this.gameState.pieces) {
      const sprite = new PieceSprite(this, piece, (pieceId) => {
        sendMessage({ type: "MOVE_PIECE", pieceId });
      }, boardX, boardY);
      this.pieceSprites.set(piece.id, sprite);
    }
  }

  private syncUI() {
    const state = this.gameState;
    if (!state?.players) return;

    // Resolve our ID defensively on every sync
    this.resolveMyPlayerId(state);

    const currentPlayer = state.players[state.currentPlayerIndex];
    const isMyTurn = currentPlayer?.id === this.myPlayerId;

    // Debug line — shows what the game thinks
    this.debugText?.setText(
      `me:${this.myPlayerId?.slice(0,8)} cur:${currentPlayer?.id?.slice(0,8)} myTurn:${isMyTurn} phase:${state.phase}`
    );

    const turnColor = currentPlayer
      ? `#${COLOR_HEX[currentPlayer.color as PlayerColor].toString(16).padStart(6, "0")}`
      : "#ffffff";

    this.turnIndicator.setText(
      isMyTurn
        ? "⭐ YOUR TURN"
        : `${currentPlayer?.displayName ?? "..."}'s turn`
    );
    this.turnIndicator.setColor(isMyTurn ? "#ffd700" : turnColor);

    if (state.phase === "rolling") {
      this.statusText.setText(isMyTurn ? "Tap the dice to roll!" : "Waiting...");
    } else if (state.phase === "moving") {
      this.statusText.setText(isMyTurn ? `Rolled ${state.dice?.value} — pick a piece` : "");
    } else if (state.phase === "finished") {
      this.statusText.setText("Game Over!");
    }

    this.diceSprite.setEnabled(isMyTurn && state.phase === "rolling");

    const validMoves = state.phase === "moving" && isMyTurn && state.dice
      ? getValidMoves(state, state.dice.value)
      : [];
    const selectableIds = new Set(validMoves.map((m) => m.pieceId));

    for (const [id, sprite] of this.pieceSprites) {
      sprite.setSelectable(selectableIds.has(id));
    }

    // First: sync any pieces whose visual state is behind the server (teleport, reconnect).
    // Must happen BEFORE applyStackOffsets so stateToPixel uses the correct position.
    for (const piece of state.pieces) {
      const sprite = this.pieceSprites.get(piece.id);
      if (
        sprite &&
        !sprite.isTweening &&
        JSON.stringify(sprite.data.state) !== JSON.stringify(piece.state)
      ) {
        sprite.snapTo(piece.state);
      }
    }

    // Then spread pieces that share the same square so they're all visible.
    this.applyStackOffsets(state);
  }

  private applyStackOffsets(state: LudoGameState) {
    // Group pieces by board square key — home_stretch uses just step (same color
    // can stack there; different colors can't share a square due to blockade rules)
    const groups = new Map<string, string[]>();
    for (const piece of state.pieces) {
      const s = piece.state;
      let key: string;
      if (s.location === "track") key = `track-${s.square}`;
      else if (s.location === "home_stretch") key = `hs-${piece.color}-${s.step}`;
      else continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(piece.id);
    }

    // For stacked same-color pieces: shrink + small offset so both visible
    // Stack of 2: scale 0.65, offset by ±quarter-radius
    // Stack of 3-4: scale 0.55
    const SPREAD = BOARD_PX / 15 * 0.22;
    const stackLayouts: { offset: [number, number]; scale: number }[][] = [
      // 1 piece — full size, centered
      [{ offset: [0, 0], scale: 1.0 }],
      // 2 pieces
      [{ offset: [-SPREAD, -SPREAD], scale: 0.72 },
       { offset: [ SPREAD,  SPREAD], scale: 0.72 }],
      // 3 pieces
      [{ offset: [-SPREAD, -SPREAD], scale: 0.60 },
       { offset: [ SPREAD, -SPREAD], scale: 0.60 },
       { offset: [      0,  SPREAD], scale: 0.60 }],
      // 4 pieces
      [{ offset: [-SPREAD, -SPREAD], scale: 0.55 },
       { offset: [ SPREAD, -SPREAD], scale: 0.55 },
       { offset: [-SPREAD,  SPREAD], scale: 0.55 },
       { offset: [ SPREAD,  SPREAD], scale: 0.55 }],
    ];

    // Apply layout to every piece
    for (const piece of state.pieces) {
      const s = piece.state;
      if (s.location !== "track" && s.location !== "home_stretch") continue;
      const key = s.location === "track"
        ? `track-${s.square}`
        : `hs-${piece.color}-${s.step}`;
      const ids = groups.get(key) ?? [];
      const count = Math.min(ids.length, 4);
      const layout = stackLayouts[count - 1] ?? stackLayouts[0];
      const idx = ids.indexOf(piece.id);
      const slot = layout[idx] ?? layout[0];
      const sprite = this.pieceSprites.get(piece.id);
      if (sprite) {
        // Always apply scale so stacked pieces shrink/grow correctly.
        // Skip repositioning if mid-tween — tween controls position.
        sprite.setStackOffset(slot.offset, slot.scale, sprite.isTweening);
      }
    }
  }

  private handleEvent(event: GameEvent) {
    console.log("[GameScene] handleEvent:", event.type, event);
    switch (event.type) {
      case "DICE_ROLLED": {
        this.diceSprite.showResult(event.value, () => this.syncUI());
        break;
      }
      case "PIECE_MOVED": {
        const sprite = this.pieceSprites.get(event.pieceId);
        sprite?.moveTo(event.to, () => this.syncUI());
        break;
      }
      case "PIECE_CAPTURED": {
        const captured = this.pieceSprites.get(event.capturedPieceId);
        if (captured) {
          captured.playCapture(() => {
            // After bounce, snap back to yard position from current server state
            const pieceData = this.gameState.pieces.find(p => p.id === event.capturedPieceId);
            if (pieceData) captured.snapTo(pieceData.state);
          });
        }
        break;
      }
      case "PIECE_FINISHED": {
        const sprite = this.pieceSprites.get(event.pieceId);
        sprite?.playFinish();
        break;
      }
      case "PLAYER_FINISHED": {
        const player = this.gameState.players.find((p) => p.id === event.playerId);
        this.showToast(
          `🏆 ${player?.displayName ?? "Someone"} finished #${event.rank}!`,
          "#ffd700"
        );
        break;
      }
      case "BONUS_TURN": {
        if (event.playerId === this.myPlayerId) {
          this.showToast(
            event.reason === "six" ? "🎲 Rolled a 6 — bonus turn!" : "💥 Capture! Bonus turn!",
            "#2ecc71"
          );
        }
        break;
      }
      case "FORFEITED_TURN": {
        if (event.playerId === this.myPlayerId) {
          this.showToast("😬 Three sixes — turn forfeited!", "#e74c3c");
        }
        break;
      }
    }
  }

  private drawPlayerBadges(boardX: number, y: number) {
    const W = this.scale.width;
    const spacing = W / 4;
    this.gameState.players.forEach((player, i) => {
      const x = spacing * i + spacing / 2;
      this.add.circle(x, y, 8, COLOR_HEX[player.color as PlayerColor]);
      this.add.text(x + 12, y, player.displayName.slice(0, 10), {
        fontSize: "11px",
        color: "#aaaacc",
        fontFamily: "monospace",
      }).setOrigin(0, 0.5);
    });
  }

  private showToast(message: string, color: string = "#ffffff") {
    const W = this.scale.width;
    const toast = this.add
      .text(W / 2, 200, message, {
        fontSize: "16px",
        color,
        fontFamily: "monospace",
        fontStyle: "bold",
        backgroundColor: "#1a1a2e",
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.tweens.add({
      targets: toast,
      alpha: 1,
      y: 160,
      duration: 300,
      ease: "Back.easeOut",
      onComplete: () => {
        this.time.delayedCall(1800, () => {
          this.tweens.add({
            targets: toast,
            alpha: 0,
            y: 120,
            duration: 400,
            onComplete: () => toast.destroy(),
          });
        });
      },
    });
  }

  shutdown() {
    this.unsubState?.();
    this.unsubEvent?.();
    this.pieceSprites.forEach((s) => s.destroy());
    this.diceSprite?.destroy();
  }
}
/**
 * LudoRules.ts — Pure rules engine. Zero side effects, zero dependencies.
 * All functions are deterministic given the same input.
 * Used by both server (authoritative) and client (prediction/validation).
 */

import {
  PlayerColor,
  START_SQUARES,
  HOME_ENTRY,
  SAFE_SQUARES,
  STAR_SQUARES,
  PIECES_PER_PLAYER,
  HOME_STRETCH_LENGTH,
  EXIT_ROLL,
} from "./constants";
import { Piece, PieceState, Player, LudoGameState } from "./LudoState";

// ─── Position Utilities ──────────────────────────────────────────────────────

/**
 * Convert a piece's track position to a global 0-51 index,
 * normalised from the perspective of its color's start.
 */
export function globalToLocal(globalSquare: number, color: PlayerColor): number {
  const start = START_SQUARES[color];
  return (globalSquare - start + 52) % 52;
}

export function localToGlobal(localSquare: number, color: PlayerColor): number {
  const start = START_SQUARES[color];
  return (start + localSquare) % 52;
}

/**
 * How many steps has this piece taken on the main track (0 = just entered).
 */
export function stepsOnTrack(piece: Piece): number {
  if (piece.state.location !== "track") return 0;
  return globalToLocal(piece.state.square, piece.color);
}

// ─── Move Validation ─────────────────────────────────────────────────────────

export interface MoveCandidate {
  pieceId: string;
  from: PieceState;
  to: PieceState;
  capturesId?: string; // piece id that would be captured
  isFinishing: boolean;
}

export function getValidMoves(
  state: LudoGameState,
  diceValue: number
): MoveCandidate[] {
  const currentPlayer = state.players[state.currentPlayerIndex];
  const myPieces = state.pieces.filter((p) => p.color === currentPlayer.color);
  const moves: MoveCandidate[] = [];

  for (const piece of myPieces) {
    const move = evaluateMove(piece, diceValue, state);
    if (move) moves.push(move);
  }

  return moves;
}

function evaluateMove(
  piece: Piece,
  diceValue: number,
  state: LudoGameState
): MoveCandidate | null {
  const { state: pos } = piece;

  // Already finished — can't move
  if (pos.location === "finished") return null;

  // In yard — can only exit on a 6
  if (pos.location === "yard") {
    if (diceValue !== EXIT_ROLL) return null;
    const startSquare = START_SQUARES[piece.color];
    // Check if start square is occupied by own piece (can't stack on start in classic rules)
    // Actually in Ludo you CAN stack own pieces — just can't land on self if there's a blockade
    const blockade = isBlockade(startSquare, piece.color, state);
    if (blockade) return null;

    const capturesId = getCaptureAt(startSquare, piece.color, state);
    return {
      pieceId: piece.id,
      from: pos,
      to: { location: "track", square: startSquare },
      capturesId,
      isFinishing: false,
    };
  }

  // On main track
  if (pos.location === "track") {
    const localStep = globalToLocal(pos.square, piece.color);
    const newLocalStep = localStep + diceValue;

    // Would enter home stretch
    const trackLength = 52; // steps around the whole board before home
    // Steps before home entry = 51 local steps (0 = start, 51 = home entry)
    if (newLocalStep > 51) {
      // Entering home stretch
      const homeStep = newLocalStep - 52; // steps into home stretch
      if (homeStep > HOME_STRETCH_LENGTH) return null; // overshoots
      if (homeStep === HOME_STRETCH_LENGTH) {
        // Exactly reaches home (finished)
        return {
          pieceId: piece.id,
          from: pos,
          to: { location: "finished" },
          isFinishing: true,
        };
      }
      return {
        pieceId: piece.id,
        from: pos,
        to: { location: "home_stretch", step: homeStep },
        isFinishing: false,
      };
    }

    const newGlobal = localToGlobal(newLocalStep, piece.color);
    if (isBlockade(newGlobal, piece.color, state)) return null;

    const capturesId = getCaptureAt(newGlobal, piece.color, state);
    return {
      pieceId: piece.id,
      from: pos,
      to: { location: "track", square: newGlobal },
      capturesId,
      isFinishing: false,
    };
  }

  // In home stretch
  if (pos.location === "home_stretch") {
    const newStep = pos.step + diceValue;
    if (newStep > HOME_STRETCH_LENGTH) return null; // overshoots
    if (newStep === HOME_STRETCH_LENGTH) {
      return {
        pieceId: piece.id,
        from: pos,
        to: { location: "finished" },
        isFinishing: true,
      };
    }
    return {
      pieceId: piece.id,
      from: pos,
      to: { location: "home_stretch", step: newStep },
      isFinishing: false,
    };
  }

  return null;
}

/**
 * Returns true if landing on this global square would be blocked
 * by two or more pieces of the same color (a blockade).
 */
function isBlockade(
  globalSquare: number,
  myColor: PlayerColor,
  state: LudoGameState
): boolean {
  const sameColorThere = state.pieces.filter(
    (p) =>
      p.color === myColor &&
      p.state.location === "track" &&
      p.state.square === globalSquare
  );
  return sameColorThere.length >= 2;
}

/**
 * Returns the piece id of an opponent piece that would be captured
 * by landing on this square (if not safe).
 */
function getCaptureAt(
  globalSquare: number,
  myColor: PlayerColor,
  state: LudoGameState
): string | undefined {
  if (SAFE_SQUARES.has(globalSquare)) return undefined;
  if (STAR_SQUARES.has(globalSquare)) return undefined; // star squares are safe too

  const target = state.pieces.find(
    (p) =>
      p.color !== myColor &&
      p.state.location === "track" &&
      p.state.square === globalSquare
  );
  return target?.id;
}

// ─── State Mutations (returns NEW state, never mutates) ───────────────────────

export function applyMove(
  state: LudoGameState,
  move: MoveCandidate
): LudoGameState {
  let pieces = state.pieces.map((p) => ({ ...p, state: { ...p.state } }));

  // Move the piece
  const idx = pieces.findIndex((p) => p.id === move.pieceId);
  pieces[idx] = { ...pieces[idx], state: move.to };

  // Handle capture
  if (move.capturesId) {
    const capIdx = pieces.findIndex((p) => p.id === move.capturesId);
    pieces[capIdx] = { ...pieces[capIdx], state: { location: "yard" } };
  }

  // Check if player finished all pieces
  const movedPiece = pieces[idx];
  const playerPieces = pieces.filter((p) => p.color === movedPiece.color);
  const allFinished = playerPieces.every((p) => p.state.location === "finished");

  let players = state.players;
  let rankings = [...state.rankings];

  if (allFinished) {
    const rank = rankings.length + 1;
    rankings.push(state.players[state.currentPlayerIndex].id);
    players = players.map((pl) =>
      pl.color === movedPiece.color
        ? { ...pl, finished: true, rank }
        : pl
    );
  }

  return { ...state, pieces, players, rankings };
}

export function advanceTurn(state: LudoGameState): LudoGameState {
  const activePlayers = state.players.filter((p) => !p.finished);
  if (activePlayers.length === 0) return { ...state, phase: "finished" };

  let nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
  // Skip finished players
  let safety = 0;
  while (state.players[nextIndex].finished && safety < state.players.length) {
    nextIndex = (nextIndex + 1) % state.players.length;
    safety++;
  }

  return {
    ...state,
    currentPlayerIndex: nextIndex,
    dice: null,
    consecutiveSixes: 0,
    phase: "rolling",
    turnNumber: state.turnNumber + 1,
  };
}

// ─── Game Initialisation ──────────────────────────────────────────────────────

export function createInitialState(
  roomId: string,
  players: Player[]
): LudoGameState {
  const pieces: Piece[] = [];

  for (const player of players) {
    for (let i = 0; i < PIECES_PER_PLAYER; i++) {
      pieces.push({
        id: `${player.color}-${i}`,
        color: player.color,
        index: i,
        state: { location: "yard" },
      });
    }
  }

  return {
    roomId,
    phase: "rolling",
    players,
    pieces,
    currentPlayerIndex: 0,
    dice: null,
    consecutiveSixes: 0,
    turnNumber: 0,
    rankings: [],
    lastEvent: null,
  };
}

// ─── Helpers for AI ──────────────────────────────────────────────────────────

export function isGameOver(state: LudoGameState): boolean {
  // Game ends when at most 1 player hasn't finished
  const unfinished = state.players.filter((p) => !p.finished);
  return unfinished.length <= 1;
}

export function getPiecesInYard(state: LudoGameState, color: PlayerColor): Piece[] {
  return state.pieces.filter(
    (p) => p.color === color && p.state.location === "yard"
  );
}

export function getPiecesOnTrack(state: LudoGameState, color: PlayerColor): Piece[] {
  return state.pieces.filter(
    (p) => p.color === color && p.state.location === "track"
  );
}

export function getPiecesInHomeStretch(state: LudoGameState, color: PlayerColor): Piece[] {
  return state.pieces.filter(
    (p) => p.color === color && p.state.location === "home_stretch"
  );
}

/**
 * How far ahead is a piece (0 = yard, 1-51 = track, 52-57 = home stretch, 58 = finished)
 */
export function pieceProgress(piece: Piece): number {
  switch (piece.state.location) {
    case "yard": return 0;
    case "track": return globalToLocal(piece.state.square, piece.color) + 1;
    case "home_stretch": return 52 + piece.state.step;
    case "finished": return 59;
  }
}

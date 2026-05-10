/**
 * Heuristic.ts — Scores a move candidate from -100 to +100.
 * Each heuristic is isolated so personality weights can tune them independently.
 */

import {
  LudoGameState,
  MoveCandidate,
  Piece,
  PieceState,
} from "@ludo/shared";
import {
  globalToLocal,
  pieceProgress,
  getValidMoves,
  SAFE_SQUARES,
} from "@ludo/shared";
import { PlayerColor, PLAYER_COLORS } from "@ludo/shared";

// ─── Individual Heuristics ────────────────────────────────────────────────────

/** Big reward for capturing an opponent */
export function scoreCapture(move: MoveCandidate): number {
  return move.capturesId ? 30 : 0;
}

/** Big reward for finishing a piece */
export function scoreFinish(move: MoveCandidate): number {
  return move.isFinishing ? 40 : 0;
}

/** Reward moving into home stretch */
export function scoreEnterHomeStretch(move: MoveCandidate): number {
  if (move.to.location === "home_stretch" && move.from.location === "track") {
    return 20;
  }
  return 0;
}

/** Reward getting a piece out of the yard */
export function scoreExitYard(move: MoveCandidate): number {
  return move.from.location === "yard" ? 15 : 0;
}

/**
 * Penalty for moving onto a square that an opponent can land on next turn.
 * (Simplified: checks if any opponent is within 1-6 steps behind us on the track)
 */
export function scoreExposureRisk(
  move: MoveCandidate,
  state: LudoGameState,
  myColor: PlayerColor
): number {
  if (move.to.location !== "track") return 0;
  const destSquare = move.to.square;
  if (SAFE_SQUARES.has(destSquare)) return 0; // safe — no risk

  let risk = 0;
  for (const piece of state.pieces) {
    if (piece.color === myColor) continue;
    if (piece.state.location !== "track") continue;

    const theirLocal = globalToLocal(piece.state.square, piece.color);
    const myLocalFromThem = globalToLocal(destSquare, piece.color);
    const stepsAway = (myLocalFromThem - theirLocal + 52) % 52;

    if (stepsAway >= 1 && stepsAway <= 6) {
      risk -= 12; // they can reach us
    }
  }
  return risk;
}

/** Reward advancing the furthest-back active piece (spread out) */
export function scoreAdvanceProgress(
  move: MoveCandidate,
  piece: Piece
): number {
  const before = pieceProgress(piece);
  const afterPiece: Piece = { ...piece, state: move.to };
  const after = pieceProgress(afterPiece);
  return (after - before) * 0.5; // small per-step bonus
}

/** Reward blocking an opponent from advancing (if we land near their path) */
export function scoreBlock(
  move: MoveCandidate,
  state: LudoGameState,
  myColor: PlayerColor
): number {
  if (move.to.location !== "track") return 0;
  // If we already have a piece on this square → forming/maintaining blockade
  const stackCount = state.pieces.filter(
    (p) =>
      p.color === myColor &&
      p.state.location === "track" &&
      p.state.square === (move.to as any).square
  ).length;
  return stackCount >= 1 ? 8 : 0;
}

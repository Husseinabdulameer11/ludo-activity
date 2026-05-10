/**
 * LudoAI.ts — AI player that evaluates all legal moves with weighted heuristics
 * and picks the best one with optional noise for personality variety.
 */

import {
  LudoGameState,
  MoveCandidate,
  AIPersonality,
  PlayerColor,
  getValidMoves,
} from "@ludo/shared";

import {
  scoreCapture,
  scoreFinish,
  scoreEnterHomeStretch,
  scoreExitYard,
  scoreExposureRisk,
  scoreAdvanceProgress,
  scoreBlock,
} from "./strategy/Heuristic";

import { getWeights } from "./strategy/PersonalityWeights";

export interface AIDecision {
  move: MoveCandidate;
  score: number;
  thinkingMs: number; // fake delay for UX realism
}

export class LudoAI {
  private personality: AIPersonality;
  private color: PlayerColor;

  constructor(color: PlayerColor, personality: AIPersonality) {
    this.color = color;
    this.personality = personality;
  }

  /**
   * Given the current game state and a rolled dice value,
   * returns the best move and how long to fake-think.
   */
  decide(state: LudoGameState, diceValue: number): AIDecision | null {
    const moves = getValidMoves(state, diceValue);
    if (moves.length === 0) return null;
    if (moves.length === 1) {
      return {
        move: moves[0],
        score: 0,
        thinkingMs: this.thinkingDelay(1),
      };
    }

    const weights = getWeights(this.personality);
    const scored = moves.map((move) => {
      const piece = state.pieces.find((p) => p.id === move.pieceId)!;

      let score = 0;
      score += scoreCapture(move) * weights.capture;
      score += scoreFinish(move) * weights.finish;
      score += scoreEnterHomeStretch(move) * weights.enterHomeStretch;
      score += scoreExitYard(move) * weights.exitYard;
      score += scoreExposureRisk(move, state, this.color) * weights.exposureRisk;
      score += scoreAdvanceProgress(move, piece) * weights.advanceProgress;
      score += scoreBlock(move, state, this.color) * weights.block;

      // Add controlled noise for personality variation
      const noise = (Math.random() * 2 - 1) * weights.noiseFactor * 20;
      score += noise;

      return { move, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    return {
      move: best.move,
      score: best.score,
      thinkingMs: this.thinkingDelay(moves.length),
    };
  }

  /**
   * Returns a realistic thinking delay in ms.
   * More choices → longer "thinking". Personality affects speed too.
   */
  private thinkingDelay(numMoves: number): number {
    const base = {
      aggressive: 600,
      balanced: 900,
      defensive: 1400,
      chaotic: 300,
    }[this.personality];

    const variance = Math.random() * 500;
    const complexityFactor = Math.min(numMoves * 100, 400);
    return base + variance + complexityFactor;
  }
}

// ─── AI Player Factory ────────────────────────────────────────────────────────

const AI_PERSONALITIES: AIPersonality[] = [
  "aggressive",
  "defensive",
  "balanced",
  "chaotic",
];

const AI_NAMES: Record<AIPersonality, string> = {
  aggressive: "Rex",
  defensive: "Vera",
  balanced: "Sam",
  chaotic: "Ziggy",
};

export function createAIPlayer(color: PlayerColor): {
  id: string;
  displayName: string;
  personality: AIPersonality;
  ai: LudoAI;
} {
  // Assign personality deterministically by color slot
  const colorIndex = ["red", "blue", "green", "yellow"].indexOf(color);
  const personality = AI_PERSONALITIES[colorIndex % AI_PERSONALITIES.length];
  const name = AI_NAMES[personality];

  return {
    id: `ai-${color}`,
    displayName: `${name} (AI)`,
    personality,
    ai: new LudoAI(color, personality),
  };
}

import { AIPersonality } from "@ludo/shared";

export interface PersonalityWeights {
  capture: number;
  finish: number;
  enterHomeStretch: number;
  exitYard: number;
  exposureRisk: number;   // multiplier on the risk penalty (higher = more cautious)
  advanceProgress: number;
  block: number;
  noiseFactor: number;    // 0-1, how much random noise to add (humanises decisions)
}

const WEIGHTS: Record<AIPersonality, PersonalityWeights> = {
  aggressive: {
    capture: 2.0,
    finish: 1.2,
    enterHomeStretch: 1.0,
    exitYard: 1.5,
    exposureRisk: 0.3,   // barely cares about risk
    advanceProgress: 0.8,
    block: 0.5,
    noiseFactor: 0.1,
  },
  defensive: {
    capture: 0.8,
    finish: 1.5,
    enterHomeStretch: 1.8,
    exitYard: 0.7,
    exposureRisk: 1.8,   // very risk-averse
    advanceProgress: 1.2,
    block: 1.5,
    noiseFactor: 0.1,
  },
  balanced: {
    capture: 1.2,
    finish: 1.4,
    enterHomeStretch: 1.3,
    exitYard: 1.1,
    exposureRisk: 1.0,
    advanceProgress: 1.0,
    block: 0.9,
    noiseFactor: 0.15,
  },
  chaotic: {
    capture: 1.0,
    finish: 1.0,
    enterHomeStretch: 1.0,
    exitYard: 1.0,
    exposureRisk: 0.5,
    advanceProgress: 0.5,
    block: 0.5,
    noiseFactor: 0.8,    // very unpredictable — feels like a wildcard human
  },
};

export function getWeights(personality: AIPersonality): PersonalityWeights {
  return WEIGHTS[personality];
}

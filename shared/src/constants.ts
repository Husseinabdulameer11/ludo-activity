export const BOARD_SIZE = 15;
export const PIECES_PER_PLAYER = 4;
export const HOME_STRETCH_LENGTH = 6;
export const SAFE_SQUARES = new Set([1, 9, 14, 22, 27, 35, 40, 48]); // global safe square indices

export type PlayerColor = "red" | "blue" | "green" | "yellow";
export const PLAYER_COLORS: PlayerColor[] = ["red", "blue", "green", "yellow"];

export type PlayerType = "human" | "ai";

export type AIPersonality = "aggressive" | "defensive" | "balanced" | "chaotic";

// Each color's starting square on the main track (0-indexed, 52 total)
export const START_SQUARES: Record<PlayerColor, number> = {
  red: 0,
  blue: 13,
  green: 26,
  yellow: 39,
};

// Each color's home entry square (last square before home stretch)
export const HOME_ENTRY: Record<PlayerColor, number> = {
  red: 51,
  blue: 12,
  green: 25,
  yellow: 38,
};

// Squares where opponent pieces can be captured (not safe)
export const STAR_SQUARES = new Set([8, 21, 34, 47]);

export const DICE_MIN = 1;
export const DICE_MAX = 6;
export const BONUS_ROLL_ON = 6; // rolling this grants another turn
export const EXIT_ROLL = 6;     // need this to exit the yard

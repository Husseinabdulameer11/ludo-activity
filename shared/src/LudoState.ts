import { PlayerColor, PlayerType, AIPersonality } from "./constants";

export type PieceState =
  | { location: "yard" }
  | { location: "track"; square: number }   // 0-51 global track
  | { location: "home_stretch"; step: number } // 0-5
  | { location: "finished" };

export interface Piece {
  id: string;          // e.g. "red-0", "red-1"
  color: PlayerColor;
  index: number;       // 0-3
  state: PieceState;
}

export interface Player {
  id: string;          // Discord user id OR ai-{color}
  color: PlayerColor;
  type: PlayerType;
  personality?: AIPersonality; // only for AI players
  displayName: string;
  finished: boolean;
  rank?: number;       // finishing order (1 = winner)
}

export interface DiceResult {
  value: number;
  rolledAt: number; // timestamp
}

export type GamePhase =
  | "waiting"    // in lobby, not enough players
  | "rolling"    // current player must roll
  | "moving"     // current player must pick a piece to move
  | "finished";  // game over

export interface LudoGameState {
  roomId: string;
  phase: GamePhase;
  players: Player[];
  pieces: Piece[];
  currentPlayerIndex: number;
  dice: DiceResult | null;
  consecutiveSixes: number;
  turnNumber: number;
  rankings: string[]; // player ids in finishing order
  lastEvent: GameEvent | null;
}

// Events emitted to clients for animation cues
export type GameEvent =
  | { type: "PIECE_MOVED"; pieceId: string; from: PieceState; to: PieceState }
  | { type: "PIECE_CAPTURED"; capturedPieceId: string; byPieceId: string }
  | { type: "PIECE_ENTERED_TRACK"; pieceId: string }
  | { type: "PIECE_FINISHED"; pieceId: string; playerId: string; rank: number }
  | { type: "PLAYER_FINISHED"; playerId: string; rank: number }
  | { type: "DICE_ROLLED"; playerId: string; value: number }
  | { type: "TURN_CHANGED"; playerId: string }
  | { type: "BONUS_TURN"; playerId: string; reason: "six" | "capture" }
  | { type: "FORFEITED_TURN"; playerId: string; reason: "three_sixes" };

// Client → Server messages
export type ClientMessage =
  | { type: "ROLL_DICE" }
  | { type: "MOVE_PIECE"; pieceId: string }
  | { type: "READY" };

// Server → Client messages
export type ServerMessage =
  | { type: "STATE_UPDATE"; state: LudoGameState }
  | { type: "EVENT"; event: GameEvent }
  | { type: "ERROR"; message: string };

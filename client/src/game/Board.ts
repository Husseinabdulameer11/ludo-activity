/**
 * Board.ts — Phaser board renderer.
 * Builds the Ludo board as a Graphics + GameObjects layer.
 * All positions are computed from a single BOARD_PX constant so it scales.
 */

import Phaser from "phaser";
import { PlayerColor, PLAYER_COLORS } from "@ludo/shared";

export const BOARD_PX = 700; // logical board size in pixels
const CELL = BOARD_PX / 15; // 15x15 grid

export const COLOR_HEX: Record<PlayerColor | "white" | "gray", number> = {
  red: 0xe74c3c,
  blue: 0x3498db,
  green: 0x2ecc71,
  yellow: 0xf1c40f,
  white: 0xffffff,
  gray: 0xbdc3c7,
};

// Yard bounds (top-left corner cell of each 6x6 yard)
const YARD_ORIGINS: Record<PlayerColor, { row: number; col: number }> = {
  red: { row: 0, col: 0 },
  blue: { row: 0, col: 9 },
  green: { row: 9, col: 9 },
  yellow: { row: 9, col: 0 },
};

// The 52 main track squares as [row, col] pairs (classic Ludo layout)
export const TRACK_CELLS: [number, number][] = [
  // Red start → clockwise
  [6,1],[6,2],[6,3],[6,4],[6,5],
  [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
  [0,7],
  [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],
  [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],
  [7,14],
  [8,14],[8,13],[8,12],[8,11],[8,10],[8,9],
  [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
  [14,7],
  [14,6],[13,6],[12,6],[11,6],[10,6],[9,6],
  [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],
  [7,0],
];

// Home stretch cells for each color (6 steps into center)
export const HOME_STRETCH_CELLS: Record<PlayerColor, [number, number][]> = {
  red: [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
  blue: [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  green: [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
  yellow: [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],
};

// Yard piece slots (4 circles inside each yard)
// FIX: use integer cell indices. cellToPixel adds CELL/2 to get the pixel
// centre, so passing 1.5 was adding an extra half-cell offset and pushing
// pieces off-centre inside each yard.
const YARD_SLOTS: [number, number][] = [
  [1, 1], [1, 3], [4, 1], [4, 3],
];
export function cellToPixel(row: number, col: number): { x: number; y: number } {
  return {
    x: col * CELL + CELL / 2,
    y: row * CELL + CELL / 2,
  };
}

export function trackSquareToPixel(square: number): { x: number; y: number } {
  const [row, col] = TRACK_CELLS[square];
  return cellToPixel(row, col);
}

export function homeStretchToPixel(color: PlayerColor, step: number): { x: number; y: number } {
  const [row, col] = HOME_STRETCH_CELLS[color][step];
  return cellToPixel(row, col);
}

export function yardSlotToPixel(color: PlayerColor, slotIndex: number): { x: number; y: number } {
  const origin = YARD_ORIGINS[color];
  const [dr, dc] = YARD_SLOTS[slotIndex];
  return cellToPixel(origin.row + dr, origin.col + dc);
}

export function drawBoard(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();

  // Background
  g.fillStyle(0x1a1a2e, 1);
  g.fillRect(0, 0, BOARD_PX, BOARD_PX);

  // Draw yard zones
  for (const color of PLAYER_COLORS) {
    const origin = YARD_ORIGINS[color];
    g.fillStyle(COLOR_HEX[color], 0.85);
    g.fillRect(origin.col * CELL, origin.row * CELL, CELL * 6, CELL * 6);

    // Inner white circle area
    g.fillStyle(0xfafafa, 1);
    g.fillRect(origin.col * CELL + CELL, origin.row * CELL + CELL, CELL * 4, CELL * 4);
  }

  // Draw home stretch lanes
  for (const color of PLAYER_COLORS) {
    g.fillStyle(COLOR_HEX[color], 0.6);
    for (const [row, col] of HOME_STRETCH_CELLS[color]) {
      g.fillRect(col * CELL + 1, row * CELL + 1, CELL - 2, CELL - 2);
    }
  }

  // Draw center finishing square (star)
  g.fillStyle(0xffd700, 1);
  g.fillRect(CELL * 6, CELL * 6, CELL * 3, CELL * 3);

  // Grid lines for track cells
  g.lineStyle(1, 0x2c3e50, 0.4);
  for (const [row, col] of TRACK_CELLS) {
    g.strokeRect(col * CELL, row * CELL, CELL, CELL);
  }

  // Track cell backgrounds (white)
  g.fillStyle(0xffffff, 1);
  for (const [row, col] of TRACK_CELLS) {
    g.fillRect(col * CELL + 1, row * CELL + 1, CELL - 2, CELL - 2);
  }

  // Safe squares (star marker)
  const SAFE = [1, 9, 14, 22, 27, 35, 40, 48];
  for (const sq of SAFE) {
    const [row, col] = TRACK_CELLS[sq];
    g.fillStyle(COLOR_HEX.gray, 1);
    g.fillRect(col * CELL + 2, row * CELL + 2, CELL - 4, CELL - 4);
  }

  // Start squares per color (colored indicator)
  const startIndices: Record<PlayerColor, number> = {
    red: 0, blue: 13, green: 26, yellow: 39,
  };
  for (const color of PLAYER_COLORS) {
    const sq = startIndices[color];
    const [row, col] = TRACK_CELLS[sq];
    g.fillStyle(COLOR_HEX[color], 0.7);
    g.fillRect(col * CELL + 2, row * CELL + 2, CELL - 4, CELL - 4);
  }

  return g;
}

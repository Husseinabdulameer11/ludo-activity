/**
 * Piece.ts — Visual representation of a Ludo piece.
 * Handles movement tweens, capture animations, and touch/click interaction.
 */

import Phaser from "phaser";
import { Piece as PieceData, PieceState, PlayerColor } from "@ludo/shared";
import {
  COLOR_HEX,
  trackSquareToPixel,
  homeStretchToPixel,
  yardSlotToPixel,
  cellToPixel,
  BOARD_PX,
  CELL,
} from "./Board";

const PIECE_RADIUS = (BOARD_PX / 15) * 0.38;
const MOVE_DURATION = 300; // ms per cell
const BOUNCE_SCALE = 1.4;

export type PieceClickHandler = (pieceId: string) => void;

export class PieceSprite {
  private circle: Phaser.GameObjects.Arc;
  private highlight: Phaser.GameObjects.Arc;
  private scene: Phaser.Scene;
  public data: PieceData;
  private onClick: PieceClickHandler;
  public isSelectable: boolean = false;

  constructor(
    scene: Phaser.Scene,
    pieceData: PieceData,
    onClick: PieceClickHandler
  ) {
    this.scene = scene;
    this.data = pieceData;
    this.onClick = onClick;

    const pos = stateToPixel(pieceData.state, pieceData.color, pieceData.index);

    // Outer glow ring (shown when selectable)
    this.highlight = scene.add
      .arc(pos.x, pos.y, PIECE_RADIUS + 6, 0, 360, false, COLOR_HEX[pieceData.color], 0.4)
      .setVisible(false);

    // Main piece circle
    this.circle = scene.add
      .arc(pos.x, pos.y, PIECE_RADIUS, 0, 360, false, COLOR_HEX[pieceData.color], 1)
      .setStrokeStyle(2, 0x000000, 0.7)
      .setInteractive({ useHandCursor: true });

    // Piece number label
    scene.add
      .text(pos.x, pos.y, String(pieceData.index + 1), {
        fontSize: `${PIECE_RADIUS}px`,
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.circle.on("pointerdown", () => {
      if (this.isSelectable) this.onClick(this.data.id);
    });

    this.circle.on("pointerover", () => {
      if (this.isSelectable) {
        this.scene.tweens.add({
          targets: this.circle,
          scaleX: 1.15,
          scaleY: 1.15,
          duration: 100,
          ease: "Back.easeOut",
        });
      }
    });

    this.circle.on("pointerout", () => {
      this.scene.tweens.add({
        targets: this.circle,
        scaleX: 1,
        scaleY: 1,
        duration: 100,
      });
    });
  }

  setSelectable(selectable: boolean) {
    this.isSelectable = selectable;
    this.highlight.setVisible(selectable);

    if (selectable) {
      this.scene.tweens.add({
        targets: this.highlight,
        alpha: { from: 0.2, to: 0.7 },
        duration: 600,
        yoyo: true,
        repeat: -1,
      });
    } else {
      this.scene.tweens.killTweensOf(this.highlight);
    }
  }

  moveTo(newState: PieceState, onComplete?: () => void) {
    const pos = stateToPixel(newState, this.data.color, this.data.index);
    this.data = { ...this.data, state: newState };

    this.scene.tweens.add({
      targets: [this.circle, this.highlight],
      x: pos.x,
      y: pos.y,
      duration: MOVE_DURATION,
      ease: "Cubic.easeInOut",
      onComplete: onComplete,
    });
  }

  playCapture() {
    // Flash red then bounce back to yard
    this.scene.tweens.add({
      targets: this.circle,
      scaleX: BOUNCE_SCALE,
      scaleY: BOUNCE_SCALE,
      duration: 150,
      yoyo: true,
      ease: "Bounce.easeOut",
    });
  }

  playFinish() {
    this.scene.tweens.add({
      targets: this.circle,
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 0,
      duration: 600,
      ease: "Cubic.easeOut",
    });
  }

  destroy() {
    this.circle.destroy();
    this.highlight.destroy();
  }

  get x() { return this.circle.x; }
  get y() { return this.circle.y; }
}

function stateToPixel(
  state: PieceState,
  color: PlayerColor,
  index: number
): { x: number; y: number } {
  switch (state.location) {
    case "yard":
      return yardSlotToPixel(color, index);
    case "track":
      return trackSquareToPixel(state.square);
    case "home_stretch":
      return homeStretchToPixel(color, state.step);
    case "finished":
      // Animate toward center
      return cellToPixel(7, 7);
  }
}

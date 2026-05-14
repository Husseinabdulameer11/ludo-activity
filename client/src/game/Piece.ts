/**
 * Piece.ts — Visual representation of a Ludo piece.
 * Uses Container so x/y tweening works correctly in Phaser.
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
} from "./Board";

const PIECE_RADIUS = (BOARD_PX / 15) * 0.38;
const MOVE_DURATION = 300;
const BOUNCE_SCALE = 1.4;

export type PieceClickHandler = (pieceId: string) => void;

export class PieceSprite {
  private container: Phaser.GameObjects.Container;
  private highlightGfx: Phaser.GameObjects.Graphics;
  private circleGfx: Phaser.GameObjects.Graphics;
  private hitZone: Phaser.GameObjects.Arc;
  private labelText: Phaser.GameObjects.Text;
  private scene: Phaser.Scene;
  public data: PieceData;
  private onClick: PieceClickHandler;
  public isSelectable: boolean = false;
  public isTweening: boolean = false;
  private offsetX: number;
  private offsetY: number;
  private stackOffsetX: number = 0;
  private stackOffsetY: number = 0;

  constructor(
    scene: Phaser.Scene,
    pieceData: PieceData,
    onClick: PieceClickHandler,
    offsetX: number = 0,
    offsetY: number = 0
  ) {
    this.scene = scene;
    this.data = pieceData;
    this.onClick = onClick;
    this.offsetX = offsetX;
    this.offsetY = offsetY;

    const pos = stateToPixel(pieceData.state, pieceData.color, pieceData.index);
    const sx = pos.x + offsetX;
    const sy = pos.y + offsetY;

    this.highlightGfx = scene.add.graphics();
    this.highlightGfx.fillStyle(COLOR_HEX[pieceData.color], 0.4);
    this.highlightGfx.fillCircle(0, 0, PIECE_RADIUS + 6);
    this.highlightGfx.setVisible(false);

    this.circleGfx = scene.add.graphics();
    this.circleGfx.fillStyle(COLOR_HEX[pieceData.color], 1);
    this.circleGfx.fillCircle(0, 0, PIECE_RADIUS);
    this.circleGfx.lineStyle(2, 0x000000, 0.7);
    this.circleGfx.strokeCircle(0, 0, PIECE_RADIUS);

    this.hitZone = scene.add
      .arc(0, 0, PIECE_RADIUS, 0, 360, false, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });

    this.labelText = scene.add
      .text(0, 0, String(pieceData.index + 1), {
        fontSize: `${PIECE_RADIUS}px`,
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.container = scene.add.container(sx, sy, [
      this.highlightGfx,
      this.circleGfx,
      this.hitZone,
      this.labelText,
    ]);

    this.hitZone.on("pointerdown", () => {
      if (this.isSelectable) this.onClick(this.data.id);
    });

    this.hitZone.on("pointerover", () => {
      if (this.isSelectable) {
        scene.tweens.add({ targets: this.container, scaleX: 1.15, scaleY: 1.15, duration: 100, ease: "Back.easeOut" });
      }
    });

    this.hitZone.on("pointerout", () => {
      scene.tweens.add({ targets: this.container, scaleX: 1, scaleY: 1, duration: 100 });
    });
  }

  setSelectable(selectable: boolean) {
    this.isSelectable = selectable;
    this.highlightGfx.setVisible(selectable);
    if (selectable) {
      this.scene.tweens.add({
        targets: this.highlightGfx,
        alpha: { from: 0.2, to: 0.8 },
        duration: 600, yoyo: true, repeat: -1,
      });
    } else {
      this.scene.tweens.killTweensOf(this.highlightGfx);
      this.highlightGfx.setAlpha(0.4);
    }
  }

  moveTo(newState: PieceState, onComplete?: () => void) {
    const pos = stateToPixel(newState, this.data.color, this.data.index);
    this.data = { ...this.data, state: newState };
    this.isTweening = true;
    this.stackOffsetX = 0;
    this.stackOffsetY = 0;

    this.scene.tweens.add({
      targets: this.container,
      x: pos.x + this.offsetX,
      y: pos.y + this.offsetY,
      scaleX: 1.0,
      scaleY: 1.0,
      duration: MOVE_DURATION,
      ease: "Cubic.easeInOut",
      onComplete: () => {
        this.isTweening = false;
        onComplete?.();
      },
    });
  }

  snapTo(newState: PieceState) {
    const pos = stateToPixel(newState, this.data.color, this.data.index);
    this.data = { ...this.data, state: newState };
    this.stackOffsetX = 0;
    this.stackOffsetY = 0;
    this.container.setScale(1.0);
    this.container.setPosition(pos.x + this.offsetX, pos.y + this.offsetY);
  }

  setStackOffset([ox, oy]: [number, number], scale: number = 1.0, skipPosition: boolean = false) {
    this.stackOffsetX = ox;
    this.stackOffsetY = oy;
    if (!skipPosition) {
      const pos = stateToPixel(this.data.state, this.data.color, this.data.index);
      this.container.setPosition(
        pos.x + this.offsetX + ox,
        pos.y + this.offsetY + oy
      );
    }
    this.container.setScale(scale);
  }

  playCapture(onComplete?: () => void) {
    this.scene.tweens.add({
      targets: this.container,
      scaleX: BOUNCE_SCALE, scaleY: BOUNCE_SCALE,
      duration: 150, yoyo: true, ease: "Bounce.easeOut",
      onComplete: () => onComplete?.(),
    });
  }

  playFinish() {
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1.5, scaleY: 1.5, alpha: 0,
      duration: 600, ease: "Cubic.easeOut",
    });
  }

  destroy() {
    this.container.destroy(true);
  }

  get x() { return this.container.x; }
  get y() { return this.container.y; }
}

function stateToPixel(
  state: PieceState,
  color: PlayerColor,
  index: number
): { x: number; y: number } {
  switch (state.location) {
    case "yard":          return yardSlotToPixel(color, index);
    case "track":         return trackSquareToPixel(state.square);
    case "home_stretch":  return homeStretchToPixel(color, state.step);
    case "finished":      return cellToPixel(7, 7);
  }
}
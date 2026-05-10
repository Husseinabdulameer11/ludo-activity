/**
 * Dice.ts — Visual dice with roll animation.
 */

import Phaser from "phaser";

const DICE_SIZE = 70;
const DOT_RADIUS = 6;
const ROLL_FRAMES = 12;
const FRAME_DELAY = 60;

const DOT_POSITIONS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};

export type DiceRollHandler = () => void;

export class DiceSprite {
  private container: Phaser.GameObjects.Container;
  private graphics: Phaser.GameObjects.Graphics;
  private zone: Phaser.GameObjects.Zone;
  private scene: Phaser.Scene;
  private rolling: boolean = false;
  private rollTimer?: ReturnType<typeof setInterval>;
  private onRoll: DiceRollHandler;
  private enabled: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number, onRoll: DiceRollHandler) {
    this.scene = scene;
    this.onRoll = onRoll;

    this.container = scene.add.container(x, y);
    this.graphics = scene.add.graphics();
    this.container.add(this.graphics);
    this.drawFace(1);

    this.zone = scene.add
      .zone(x, y, DICE_SIZE + 20, DICE_SIZE + 20)
      .setInteractive({ useHandCursor: true });

    this.zone.on("pointerdown", () => {
      if (this.enabled && !this.rolling) {
        // Disable immediately so double-clicks and state updates can't re-fire
        this.enabled = false;
        this.container.setAlpha(0.4);
        this.onRoll();
      }
    });

    this.zone.on("pointerover", () => {
      if (!this.enabled || this.rolling) return;
      scene.tweens.killTweensOf(this.container);
      scene.tweens.add({ targets: this.container, scaleX: 1.08, scaleY: 1.08, duration: 100 });
    });

    this.zone.on("pointerout", () => {
      scene.tweens.killTweensOf(this.container);
      scene.tweens.add({ targets: this.container, scaleX: 1, scaleY: 1, duration: 100 });
    });
  }

  /** Called by syncUI with whether the game state says it's our turn to roll. */
  setEnabled(enabled: boolean) {
    // Never re-enable while an animation is running — wait for showResult to finish
    if (this.rolling) return;
    this.enabled = enabled;
    this.container.setAlpha(enabled ? 1 : 0.4);
    // Reset scale in case a hover tween was interrupted
    this.container.setScale(1);
  }

  /** Animate a roll then land on `value`. Calls onComplete when done. */
  showResult(value: number, onComplete?: () => void) {
    this.rolling = true;
    this.enabled = false;
    this.container.setAlpha(0.4);
    let frame = 0;

    this.rollTimer = setInterval(() => {
      const showVal = frame < ROLL_FRAMES - 1
        ? (Math.floor(Math.random() * 6) + 1)
        : value;
      this.drawFace(showVal);
      frame++;

      if (frame >= ROLL_FRAMES) {
        clearInterval(this.rollTimer);
        this.rolling = false;
        this.shakeAnimation(onComplete);
      }
    }, FRAME_DELAY);
  }

  private shakeAnimation(onComplete?: () => void) {
    const originX = this.container.x;
    this.scene.tweens.add({
      targets: this.container,
      x: originX + 6,
      duration: 50,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        this.container.x = originX;
        onComplete?.();
      },
    });
  }

  private drawFace(value: number) {
    const g = this.graphics;
    g.clear();

    const x = -DICE_SIZE / 2;
    const y = -DICE_SIZE / 2;

    g.fillStyle(0x000000, 0.2);
    g.fillRoundedRect(x + 4, y + 4, DICE_SIZE, DICE_SIZE, 12);

    g.fillStyle(value === 6 ? 0xffd700 : 0xfafafa, 1);
    g.fillRoundedRect(x, y, DICE_SIZE, DICE_SIZE, 12);
    g.lineStyle(2, 0x333333, 0.8);
    g.strokeRoundedRect(x, y, DICE_SIZE, DICE_SIZE, 12);

    g.fillStyle(0x1a1a1a, 1);
    const padding = 14;
    const cellSize = (DICE_SIZE - padding * 2) / 3;
    for (const [col, row] of DOT_POSITIONS[value]) {
      const dotX = x + padding + col * cellSize + cellSize / 2;
      const dotY = y + padding + row * cellSize + cellSize / 2;
      g.fillCircle(dotX, dotY, DOT_RADIUS);
    }
  }

  destroy() {
    clearInterval(this.rollTimer);
    this.scene.tweens.killTweensOf(this.container);
    this.graphics.destroy();
    this.zone.destroy();
    this.container.destroy();
  }
}
/**
 * LobbyScene.ts — Live lobby that updates as players join.
 * Subscribes to LOBBY_UPDATE from the server so names appear in real time.
 */

import Phaser from "phaser";
import { sendMessage, onLobbyUpdate } from "../game/Connection";
import { PLAYER_COLORS, PlayerColor } from "@ludo/shared";
import { COLOR_HEX } from "../game/Board";

const COLOR_NAMES: Record<PlayerColor, string> = {
  red: "Red",
  blue: "Blue",
  green: "Green",
  yellow: "Yellow",
};

interface LobbyOptions {
  isHost: boolean;
  myId: string;
}

interface LobbyPlayer {
  id: string;
  displayName: string;
  color: string;
}

export class LobbyScene extends Phaser.Scene {
  private opts!: LobbyOptions;
  private unsubLobby!: () => void;

  // References to the parts of each card that change
  private cardNames: Phaser.GameObjects.Text[] = [];
  private cardBadges: Phaser.GameObjects.Text[] = [];
  private cardBgs: Phaser.GameObjects.Rectangle[] = [];
  private cardBorders: Phaser.GameObjects.Graphics[] = [];

  constructor() {
    super({ key: "LobbyScene" });
  }

  init(data: LobbyOptions) {
    this.opts = data;
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.add.rectangle(0, 0, W, H, 0x1a1a2e).setOrigin(0);

    this.add.text(W / 2, 60, "🎲 LUDO", {
      fontSize: "48px",
      color: "#ffd700",
      fontFamily: "'Courier New', monospace",
      fontStyle: "bold",
    }).setOrigin(0.5);

    this.add.text(W / 2, 110, "Waiting for players...", {
      fontSize: "18px",
      color: "#aaaacc",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    // Build the 4 player cards
    const slotY = 180;
    PLAYER_COLORS.forEach((color, i) => {
      const cardX = W / 2;
      const cardY = slotY + i * 90;

      const bg = this.add.rectangle(cardX, cardY, W - 60, 70, 0x16213e).setOrigin(0.5);
      this.cardBgs.push(bg);

      const border = this.add.graphics();
      this.cardBorders.push(border);

      // Color dot (static)
      this.add.circle(cardX - (W / 2 - 50), cardY, 16, COLOR_HEX[color]);

      // Name (dynamic)
      const nameText = this.add.text(cardX - (W / 2 - 80), cardY - 10, "AI Player", {
        fontSize: "18px",
        color: "#666688",
        fontFamily: "monospace",
        fontStyle: "italic",
      }).setOrigin(0, 0.5);
      this.cardNames.push(nameText);

      // Color label (static)
      this.add.text(cardX - (W / 2 - 80), cardY + 14, COLOR_NAMES[color], {
        fontSize: "13px",
        color: `#${COLOR_HEX[color].toString(16).padStart(6, "0")}`,
        fontFamily: "monospace",
      }).setOrigin(0, 0.5);

      // Badge (dynamic)
      const badge = this.add.text(cardX + W / 2 - 50, cardY, "AI", {
        fontSize: "13px",
        color: "#666688",
        fontFamily: "monospace",
        backgroundColor: "#0d0d1a",
        padding: { x: 6, y: 3 },
      }).setOrigin(1, 0.5);
      this.cardBadges.push(badge);
    });

    // Start button
    if (this.opts.isHost) {
      const btnY = H - 100;
      const btn = this.add.rectangle(W / 2, btnY, 220, 56, 0x2ecc71)
        .setInteractive({ useHandCursor: true });
      this.add.text(W / 2, btnY, "START GAME", {
        fontSize: "20px",
        color: "#000000",
        fontFamily: "monospace",
        fontStyle: "bold",
      }).setOrigin(0.5);
      btn.on("pointerdown", () => sendMessage({ type: "READY" }));
      btn.on("pointerover", () => btn.setFillStyle(0x27ae60));
      btn.on("pointerout", () => btn.setFillStyle(0x2ecc71));
      this.add.text(W / 2, btnY + 42, "Empty slots will be filled with AI", {
        fontSize: "12px",
        color: "#888899",
        fontFamily: "monospace",
      }).setOrigin(0.5);
    } else {
      this.add.text(W / 2, H - 80, "Waiting for host to start...", {
        fontSize: "15px",
        color: "#666688",
        fontFamily: "monospace",
      }).setOrigin(0.5);
    }

    // Subscribe to live player list from server
    this.unsubLobby = onLobbyUpdate((players) => this.refreshCards(players, W));
  }

  private refreshCards(players: LobbyPlayer[], W: number) {
    PLAYER_COLORS.forEach((color, i) => {
      const player = players[i];
      const isMe = player?.id === this.opts.myId;
      const isHuman = !!player;

      const nameText = this.cardNames[i];
      const badge = this.cardBadges[i];
      const bg = this.cardBgs[i];
      const border = this.cardBorders[i];

      if (isHuman) {
        const label = isMe ? player.displayName + " (You)" : player.displayName;
        nameText.setText(label);
        nameText.setColor(isMe ? "#ffd700" : "#ffffff");
        nameText.setFontStyle("normal");

        badge.setText(isMe ? "YOU" : "");
        badge.setColor("#ffd700");
        badge.setBackgroundColor(isMe ? "#2a2200" : "");

        bg.setFillStyle(isMe ? 0x2a2a1e : 0x16213e);

        border.clear();
        if (isMe) {
          border.lineStyle(2, 0xffd700, 1);
          border.strokeRect(W / 2 - (W - 60) / 2, 180 + i * 90 - 35, W - 60, 70);
        }
      } else {
        nameText.setText("AI Player");
        nameText.setColor("#666688");
        nameText.setFontStyle("italic");
        badge.setText("AI");
        badge.setColor("#666688");
        badge.setBackgroundColor("#0d0d1a");
        bg.setFillStyle(0x16213e);
        border.clear();
      }
    });
  }

  shutdown() {
    this.unsubLobby?.();
  }
}
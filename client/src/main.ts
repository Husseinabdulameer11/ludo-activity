/**
 * main.ts — Entry point. Initialises Discord SDK, connects to the game server,
 * then boots Phaser with the right scene.
 */

import Phaser from "phaser";
import { initDiscord } from "./discord/sdk";
import { joinOrCreateRoom, onStateUpdate } from "./game/Connection";
import { LobbyScene } from "./scenes/LobbyScene";
import { GameScene } from "./scenes/GameScene";

// ─── Phaser Config ────────────────────────────────────────────────────────────

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,           // WebGL preferred, Canvas fallback
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: "#1a1a2e",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 800,
    height: 900,
  },
  scene: [LobbyScene, GameScene],
  parent: "game-container",
  input: {
    touch: true,              // Enable touch for mobile
  },
};

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  const loadingEl = document.getElementById("loading")!;
  loadingEl.textContent = "Connecting to Discord...";

  let discordCtx;
  try {
    discordCtx = await initDiscord();
  } catch (e) {
    console.error("Discord SDK failed to initialise:", e);
    document.getElementById("loading")!.textContent = "Failed to connect to Discord. Please open this inside Discord.";
    return;
  }

  loadingEl.textContent = "Joining game room...";

  const room = await joinOrCreateRoom({
    displayName: discordCtx.user.username,
    discordUserId: discordCtx.user.id,
  });

  loadingEl.style.display = "none";

  const game = new Phaser.Game(config);

  // Track both possible IDs we might be assigned on the server:
  // - discordCtx.user.id  (sent as discordUserId; used when present)
  // - room.sessionId      (Colyseus fallback when discordUserId is absent)
  const myIds = new Set([discordCtx.user.id, room.sessionId]);

  // Start in lobby — assume host until server state tells us otherwise
  game.scene.start("LobbyScene", {
    isHost: true,
    myId: discordCtx.user.id,
  });

  // When server says game started (phase changes from waiting to rolling/moving)
  const unsub = onStateUpdate((state) => {
    if (!state || !state.phase) return;

    if (state.phase === "rolling" || state.phase === "moving") {
      // Find our player slot by checking both possible ID values
      const myPlayer = state.players?.find((p: any) => myIds.has(p.id));
      // Resolve to whichever ID the server actually assigned us
      const resolvedId = myPlayer?.id ?? discordCtx.user.id;

      game.scene.stop("LobbyScene");
      game.scene.start("GameScene", {
        myPlayerId: resolvedId,
        initialState: state,
      });
      unsub();
    }
  });
}

boot().catch((err) => {
  console.error("Boot failed:", err);
  document.getElementById("loading")!.textContent = "Failed to connect. Please refresh.";
});
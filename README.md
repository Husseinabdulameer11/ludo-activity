# 🎲 Ludo — Discord Activity

A fully featured Ludo game playable as a Discord Activity. Supports 1–4 human players, with AI filling empty slots. Built with **Phaser 3**, **Colyseus**, **TypeScript**, and the **Discord Embedded App SDK**.

---

## Architecture

```
ludo-activity/
├── shared/          # Pure TypeScript — rules engine, types, constants
│   └── src/
│       ├── constants.ts     # Board geometry, colors, safe squares
│       ├── LudoState.ts     # All game state types + message types
│       └── LudoRules.ts     # Pure rules engine (no side effects)
│
├── server/          # Node.js + Colyseus WebSocket game server
│   └── src/
│       ├── index.ts         # Express + Colyseus boot
│       ├── tokenRoute.ts    # Discord OAuth token exchange
│       ├── rooms/
│       │   └── LudoRoom.ts  # Authoritative game room (turn logic, AI scheduling)
│       └── ai/
│           ├── LudoAI.ts    # AI player with personality system
│           └── strategy/
│               ├── Heuristic.ts          # Individual scoring functions
│               └── PersonalityWeights.ts # Per-personality heuristic weights
│
└── client/          # Phaser 3 + Discord SDK frontend
    └── src/
        ├── main.ts               # Boot: Discord → Colyseus → Phaser
        ├── discord/sdk.ts        # Discord Activity SDK wrapper
        ├── game/
        │   ├── Connection.ts     # Colyseus client + pub/sub
        │   ├── Board.ts          # Static board renderer
        │   ├── Piece.ts          # Animated piece sprites
        │   └── Dice.ts           # Animated dice widget
        └── scenes/
            ├── LobbyScene.ts     # Pre-game player list
            └── GameScene.ts      # Main game
```

---

## AI System

The AI uses **weighted heuristics** — no ML required. Each AI evaluates all legal moves and scores them across 7 dimensions:

| Heuristic | Description |
|-----------|-------------|
| `capture` | Landing on and sending an opponent back to yard |
| `finish` | Moving a piece into the finished state |
| `enterHomeStretch` | Transitioning from track to home lane |
| `exitYard` | Getting a piece out on a 6 |
| `exposureRisk` | Penalty for landing where an opponent can reach next turn |
| `advanceProgress` | Small bonus for raw forward progress |
| `block` | Bonus for stacking on the same square (forming blockades) |

Each AI player has a **personality** that reweights these heuristics:

| Color | Personality | Style |
|-------|-------------|-------|
| 🔴 Red | Aggressive (Rex) | Hunts captures, ignores risk |
| 🔵 Blue | Defensive (Vera) | Safe play, blockades |
| 🟢 Green | Balanced (Sam) | Even weights, classic play |
| 🟡 Yellow | Chaotic (Ziggy) | High noise factor, unpredictable |

---

## Setup

### 1. Prerequisites
- Node.js 18+
- A Discord Application with Activities enabled

### 2. Discord Developer Setup
1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Create a new application
3. Under **Activities**, enable the Activity and note your **Client ID**
4. Under **OAuth2**, add `http://localhost:3000` as a redirect URI
5. Copy **Client ID** and **Client Secret**

### 3. Install & Configure
```bash
git clone <your-repo>
cd ludo-activity
cp .env.example .env
# Fill in your Discord Client ID and Secret in .env
npm install
```

### 4. Run in Development
```bash
npm run dev
```
This starts both the game server (`:2567`) and the Vite dev server (`:3000`) concurrently.

Then in Discord, run `/activities start` in a voice channel, or use the Discord developer mode to point your activity at `http://localhost:3000`.

### 5. Production Build
```bash
npm run build
# Deploy server/ to any Node host (Railway, Fly.io, etc.)
# Deploy client/dist/ to any static host, or serve from Express
```

---

## Game Rules Implemented

- ✅ Standard 52-square track + 6-step home stretches
- ✅ Need a 6 to exit the yard
- ✅ Rolling a 6 or capturing grants a bonus turn
- ✅ Three consecutive sixes forfeits the turn
- ✅ Safe squares (no captures)
- ✅ Blockades (two same-color pieces block opponents)
- ✅ Stacking own pieces
- ✅ Finishing order tracked (1st, 2nd, 3rd place)
- ✅ Departed human players replaced by AI mid-game

---

## Adding More Difficulty Levels

To add Easy/Medium/Hard difficulty, modify `PersonalityWeights.ts`:

```typescript
// Easy: AI makes obvious mistakes
easy: {
  capture: 0.4,
  finish: 0.8,
  noiseFactor: 0.6,  // lots of randomness
  ...
}

// Hard: near-optimal play
hard: {
  capture: 2.5,
  finish: 2.0,
  exposureRisk: 2.0,
  noiseFactor: 0.02,  // almost deterministic
  ...
}
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Game rendering | Phaser 3 (WebGL/Canvas) |
| Real-time sync | Colyseus (WebSocket rooms) |
| Discord integration | @discord/embedded-app-sdk |
| Language | TypeScript throughout |
| Bundler | Vite |
| Server runtime | Node.js + Express |
| Mobile support | Phaser touch input + Scale.FIT |

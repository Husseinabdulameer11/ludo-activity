import { Server } from "colyseus";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import { LudoRoom } from "./rooms/LudoRoom";
import { tokenRoute } from "./tokenRoute";
import "dotenv/config";



const PORT = parseInt(process.env.PORT ?? "2567", 10);

const app = express();
app.use(cors());
app.use(express.json());

app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://ricky-unagile-georgeanna.ngrok-free.app"
  ]
}));

// Health check for Discord Activity hosting
app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/token", tokenRoute);
const httpServer = createServer(app);

const gameServer = new Server({ server: httpServer });

// Register our room type
gameServer.define("ludo", LudoRoom);

gameServer.listen(PORT).then(() => {
  console.log(`🎲 Ludo game server running on ws://localhost:${PORT}`);
});

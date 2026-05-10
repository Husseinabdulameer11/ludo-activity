/**
 * Connection.ts — Manages the Colyseus WebSocket connection to the game server.
 */

import * as Colyseus from "colyseus.js";
import { LudoGameState, ServerMessage, ClientMessage } from "@ludo/shared";

// When running inside Discord, all traffic must go through the discordsays.com proxy.
// We detect this by checking if the page origin ends with .discordsays.com.
function resolveServerUrl(): string {
  const envUrl = import.meta.env.VITE_SERVER_URL as string;
  if (typeof window !== "undefined" && window.location.hostname.endsWith(".discordsays.com")) {
    // Build the proxied WebSocket URL from the current origin
    const clientId = window.location.hostname.split(".")[0];
    return `wss://${clientId}.discordsays.com/.proxy/colyseus`;
  }
  return envUrl ?? "ws://localhost:2567";
}

const SERVER_URL = resolveServerUrl();

let _client: Colyseus.Client | null = null;
let _room: Colyseus.Room<LudoGameState> | null = null;

export type StateHandler = (state: LudoGameState) => void;
export type EventHandler = (msg: ServerMessage) => void;

const stateHandlers: StateHandler[] = [];
const eventHandlers: EventHandler[] = [];

export async function joinOrCreateRoom(opts: {
  displayName: string;
  discordUserId: string;
}): Promise<Colyseus.Room<LudoGameState>> {
  _client = new Colyseus.Client(SERVER_URL);

  _room = await _client.joinOrCreate<LudoGameState>("ludo", opts);

  setupLobbyListener();
  _room.onMessage("STATE_UPDATE", (msg: ServerMessage) => {
    if (msg.type === "STATE_UPDATE") {
      stateHandlers.forEach((h) => h(msg.state));
    }
  });

  _room.onMessage("EVENT", (msg: ServerMessage) => {
    eventHandlers.forEach((h) => h(msg));
  });

  _room.onLeave(() => {
    console.warn("Disconnected from game room");
  });

  return _room;
}

export function onStateUpdate(handler: StateHandler): () => void {
  stateHandlers.push(handler);
  return () => {
    const i = stateHandlers.indexOf(handler);
    if (i !== -1) stateHandlers.splice(i, 1);
  };
}

export function onEvent(handler: EventHandler): () => void {
  eventHandlers.push(handler);
  return () => {
    const i = eventHandlers.indexOf(handler);
    if (i !== -1) eventHandlers.splice(i, 1);
  };
}

export function sendMessage(msg: ClientMessage) {
  _room?.send(msg.type, msg);
}

export function getRoom() {
  return _room;
}

export type LobbyHandler = (players: { id: string; displayName: string; color: string }[]) => void;
const lobbyHandlers: LobbyHandler[] = [];

export function onLobbyUpdate(handler: LobbyHandler): () => void {
  lobbyHandlers.push(handler);
  return () => {
    const i = lobbyHandlers.indexOf(handler);
    if (i !== -1) lobbyHandlers.splice(i, 1);
  };
}

// Wire up inside joinOrCreateRoom — called after _room is set
function setupLobbyListener() {
  _room?.onMessage("LOBBY_UPDATE", (msg: { players: { id: string; displayName: string; color: string }[] }) => {
    lobbyHandlers.forEach((h) => h(msg.players));
  });
}

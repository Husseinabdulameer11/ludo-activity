/**
 * discord/sdk.ts — Thin wrapper around the Discord Embedded App SDK.
 * In dev mode (IS_DEV), skips OAuth entirely and returns a local mock context.
 * In production (inside Discord), runs the real OAuth flow.
 */

import { DiscordSDK } from "@discord/embedded-app-sdk";
console.log("ENV:", (import.meta as any).env);
export interface DiscordParticipant {
  id: string;
  username: string;
  avatar: string | null;
}

export interface DiscordContext {
  sdk: DiscordSDK | null;
  channelId: string;
  guildId: string | null;
  user: { id: string; username: string; avatar: string | null };
  participants: DiscordParticipant[];
  accessToken: string;
}

const CLIENT_ID = (import.meta as any).env.VITE_DISCORD_CLIENT_ID as string;
let _ctx: DiscordContext | null = null;

export async function initDiscord(): Promise<DiscordContext> {
  if (_ctx) return _ctx;

  // ── Always run the real Discord OAuth flow ────────────────────────────────
  const sdk = new DiscordSDK(CLIENT_ID);
  await sdk.ready();

  // Patch all URLs to go through Discord's proxy (required for both test and production)
  const { patchUrlMappings } = await import("@discord/embedded-app-sdk");
const serverHost = (import.meta as any).env.VITE_SERVER_HOST as string;patchUrlMappings([
  { prefix: "/colyseus", target: serverHost },

]);

  const { code } = await sdk.commands.authorize({
    client_id: CLIENT_ID,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify", "guilds.members.read"],
  });

  const tokenRes = await fetch("https://ludo-activity.pages.dev/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const { access_token } = await tokenRes.json();

  await sdk.commands.authenticate({ access_token });

  const userRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const user = await userRes.json();

  const participants = await getParticipants(sdk);

  _ctx = {
    sdk,
    channelId: sdk.channelId ?? "unknown",
    guildId: sdk.guildId ?? null,
    user: {
      id: user.id,
      username: user.username,
      avatar: user.avatar,
    },
    participants,
    accessToken: access_token,
  };

  sdk.subscribe("ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE", (data: any) => {
    if (_ctx) _ctx.participants = data.participants ?? [];
  });

  return _ctx;
}

async function getParticipants(sdk: DiscordSDK): Promise<DiscordParticipant[]> {
  try {
    const result = await sdk.commands.getInstanceConnectedParticipants();
    return (result.participants ?? []).map((p: any) => ({
      id: p.id,
      username: p.username,
      avatar: p.avatar ?? null,
    }));
  } catch {
    return [];
  }
}

export function getDiscordContext(): DiscordContext | null {
  return _ctx;
}

export function avatarUrl(userId: string, avatarHash: string | null): string {
  if (!avatarHash) {
    const disc = parseInt(userId) % 5;
    return `https://cdn.discordapp.com/embed/avatars/${disc}.png`;
  }
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=64`;
}

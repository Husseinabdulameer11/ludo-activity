/**
 * tokenRoute.ts — Discord OAuth2 code → access_token exchange.
 * Add this to your Express app in server/src/index.ts
 *
 * Usage in index.ts:
 *   import { tokenRoute } from "./tokenRoute";
 *   app.post("/api/token", tokenRoute);
 */

import { Request, Response } from "express";

export async function tokenRoute(req: Request, res: Response) {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: "Missing code" });
  }

  const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
  const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET!;

  try {
    const response = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Discord token exchange failed:", data);
      return res.status(response.status).json({ error: "Token exchange failed" });
    }

    return res.json({ access_token: data.access_token });
  } catch (err) {
    console.error("Token route error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

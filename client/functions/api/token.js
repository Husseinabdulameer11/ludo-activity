export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (context.request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  const body = await context.request.json();
  const { code } = body;

  if (!code) {
    return new Response(JSON.stringify({ error: "Missing code" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: context.env.DISCORD_CLIENT_ID,
      client_secret: context.env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
    }),
  });

  const data = await response.json();
  console.log("Discord token response:", JSON.stringify(data));

  return new Response(JSON.stringify({ access_token: data.access_token }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
  });
}
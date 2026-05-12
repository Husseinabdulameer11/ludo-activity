export async function onRequestPost(context) {
  const body = await context.request.json();
  const { code } = body;

  if (!code) {
    return new Response(JSON.stringify({ error: "Missing code" }), { status: 400 });
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
  return new Response(JSON.stringify({ access_token: data.access_token }), {
    headers: { "Content-Type": "application/json" },
  });
}
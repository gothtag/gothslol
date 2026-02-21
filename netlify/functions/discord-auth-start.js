const DISCORD_AUTH_URL = "https://discord.com/api/oauth2/authorize";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async function handler(event) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return json(500, {
      error: "Missing DISCORD_CLIENT_ID or DISCORD_REDIRECT_URI",
    });
  }

  const slot = (event.queryStringParameters?.slot || "").toLowerCase();
  if (slot !== "ev" && slot !== "ey") {
    return json(400, {
      error: "Missing or invalid slot. Use ?slot=ev or ?slot=ey",
    });
  }

  const state = `slot:${slot}`;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "identify",
    prompt: "consent",
    state,
  });

  const url = `${DISCORD_AUTH_URL}?${params.toString()}`;

  if (event.queryStringParameters?.redirect === "1") {
    return {
      statusCode: 302,
      headers: {
        location: url,
        "cache-control": "no-store",
      },
      body: "",
    };
  }

  return json(200, { slot, url });
};

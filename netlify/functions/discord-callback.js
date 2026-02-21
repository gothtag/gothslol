const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const DISCORD_ME_URL = "https://discord.com/api/users/@me";
const { setJson } = require("./discord-store");

function html(statusCode, markup) {
  return {
    statusCode,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
    body: markup,
  };
}

function toAvatarUrl(id, avatar) {
  if (!id) {
    return null;
  }
  if (!avatar) {
    const index = Number((BigInt(id) >> 22n) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  }
  const ext = avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${id}/${avatar}.${ext}?size=256`;
}

async function exchangeCode(code, clientId, clientSecret, redirectUri) {
  const payload = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch(DISCORD_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: payload.toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || "Discord token exchange failed");
  }

  return data;
}

async function fetchMe(accessToken) {
  const response = await fetch(DISCORD_ME_URL, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch Discord profile");
  }

  return data;
}

exports.handler = async function handler(event) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return html(500, "<h1>Missing Discord env vars</h1><p>Set DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI.</p>");
  }

  const code = event.queryStringParameters?.code;
  const state = event.queryStringParameters?.state || "slot:unknown";
  const error = event.queryStringParameters?.error;

  if (error) {
    return html(400, `<h1>Discord denied auth</h1><p>${error}</p>`);
  }

  if (!code) {
    return html(400, "<h1>Missing code</h1>");
  }

  const slot = state.startsWith("slot:") ? state.replace("slot:", "") : "unknown";

  try {
    const tokenData = await exchangeCode(code, clientId, clientSecret, redirectUri);
    const me = await fetchMe(tokenData.access_token);
    const avatarUrl = toAvatarUrl(me.id, me.avatar);

    if (slot === "ev" || slot === "ey") {
      await setJson(`discord:${slot}:refresh_token`, {
        value: tokenData.refresh_token,
      });
      await setJson(`discord:${slot}:user_id`, {
        value: me.id,
      });
    }

    const safe = (value) => String(value || "").replace(/[&<>\"]/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
    }[ch] || ch));

    return html(
      200,
      `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Discord linked</title></head>
<body style="font-family:Arial,sans-serif;background:#111;color:#eee;padding:24px;">
  <h1>Discord linked for slot: ${safe(slot)}</h1>
  <p>User: <strong>${safe(me.username)}#${safe(me.discriminator)}</strong> (${safe(me.id)})</p>
  <p>Saved automatically to Netlify Blobs for this slot.</p>
  <p>Fallback values (only if you want to store manually in env vars):</p>
  <pre style="white-space:pre-wrap;background:#1c1c1c;padding:12px;border-radius:8px;">DISCORD_${safe(slot).toUpperCase()}_USER_ID=${safe(me.id)}
DISCORD_${safe(slot).toUpperCase()}_REFRESH_TOKEN=${safe(tokenData.refresh_token)}</pre>
  <p>Avatar preview:</p>
  <img src="${safe(avatarUrl)}" alt="avatar" width="96" height="96" style="border-radius:50%;" />
  <p style="margin-top:18px;color:#bbb;">After saving env vars, redeploy your Netlify site.</p>
</body>
</html>`
    );
  } catch (err) {
    return html(500, `<h1>OAuth callback failed</h1><pre>${String(err.message || err)}</pre>`);
  }
};

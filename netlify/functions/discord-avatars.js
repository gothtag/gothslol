const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const DISCORD_ME_URL = "https://discord.com/api/users/@me";

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

function buildAvatarUrl(userId, avatarHash) {
  if (!userId) {
    return null;
  }

  if (!avatarHash) {
    const index = Number((BigInt(userId) >> 22n) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  }

  const extension = avatarHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${extension}?size=256`;
}

async function refreshAccessToken(refreshToken, clientId, clientSecret) {
  const payload = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
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
    throw new Error(data.error_description || data.error || "Failed to refresh access token");
  }

  return data;
}

async function fetchDiscordProfile(accessToken) {
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

async function resolveSlotAvatar({ slot, refreshToken, expectedUserId, clientId, clientSecret }) {
  if (!refreshToken) {
    return {
      slot,
      error: `Missing DISCORD_${slot.toUpperCase()}_REFRESH_TOKEN`,
      avatarUrl: null,
    };
  }

  const tokenData = await refreshAccessToken(refreshToken, clientId, clientSecret);
  const profile = await fetchDiscordProfile(tokenData.access_token);

  const avatarUrl = buildAvatarUrl(profile.id, profile.avatar);
  const userMismatch = expectedUserId && expectedUserId !== profile.id;

  return {
    slot,
    userId: profile.id,
    username: profile.username,
    avatar: profile.avatar,
    avatarUrl,
    userMismatch,
    refreshedAt: new Date().toISOString(),
    nextRefreshToken: tokenData.refresh_token || null,
  };
}

exports.handler = async function handler() {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return json(500, {
      error: "Missing DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET",
    });
  }

  try {
    const [ev, ey] = await Promise.all([
      resolveSlotAvatar({
        slot: "ev",
        refreshToken: process.env.DISCORD_EV_REFRESH_TOKEN,
        expectedUserId: process.env.DISCORD_EV_USER_ID,
        clientId,
        clientSecret,
      }),
      resolveSlotAvatar({
        slot: "ey",
        refreshToken: process.env.DISCORD_EY_REFRESH_TOKEN,
        expectedUserId: process.env.DISCORD_EY_USER_ID,
        clientId,
        clientSecret,
      }),
    ]);

    return json(200, {
      ev,
      ey,
    });
  } catch (err) {
    return json(500, {
      error: String(err.message || err),
    });
  }
};

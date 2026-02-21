const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const DISCORD_ME_URL = "https://discord.com/api/users/@me";
const { getJson, setJson } = require("./discord-store");
const AVATAR_CACHE_MS = 5000;

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

function redirect(location) {
  return {
    statusCode: 302,
    headers: {
      location,
      "cache-control": "no-store",
    },
    body: "",
  };
}

function plain(statusCode, message) {
  return {
    statusCode,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
    body: message,
  };
}

function defaultAvatarUrl(userId) {
  if (!userId) {
    return "https://cdn.discordapp.com/embed/avatars/0.png";
  }

  return buildAvatarUrl(userId, null);
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

async function fetchClanBadge(accessToken, userId) {
  try {
    const profile = await fetchDiscordProfile(accessToken);
    
    if (profile.clan) {
      const clanBadge = profile.clan.badge;
      const clanTag = profile.clan.tag;
      const clanIdentityGuildId = profile.clan.identity_guild_id;
      
      if (clanBadge && clanIdentityGuildId) {
        const badgeUrl = `https://cdn.discordapp.com/clan-badges/${clanIdentityGuildId}/${clanBadge}.png`;
        return {
          tag: clanTag || null,
          badgeUrl,
        };
      }
    }
    
    return null;
  } catch (err) {
    return null;
  }
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
  const clanInfo = await fetchClanBadge(tokenData.access_token, profile.id);

  const avatarUrl = buildAvatarUrl(profile.id, profile.avatar);
  const userMismatch = expectedUserId && expectedUserId !== profile.id;
  
  let avatarDecorationUrl = null;
  if (profile.avatar_decoration_data && profile.avatar_decoration_data.asset) {
    avatarDecorationUrl = `https://cdn.discordapp.com/avatar-decoration-presets/${profile.avatar_decoration_data.asset}.png`;
  }

  if (tokenData.refresh_token) {
    await setJson(`discord:${slot}:refresh_token`, {
      value: tokenData.refresh_token,
    });
  }

  await setJson(`discord:${slot}:user_id`, {
    value: profile.id,
  });

  if (clanInfo) {
    await setJson(`discord:${slot}:clan_tag`, {
      value: clanInfo.tag,
    });
    await setJson(`discord:${slot}:clan_badge_url`, {
      value: clanInfo.badgeUrl,
    });
  }
  
  if (avatarDecorationUrl) {
    await setJson(`discord:${slot}:avatar_decoration_url`, {
      value: avatarDecorationUrl,
    });
  }

  return {
    slot,
    userId: profile.id,
    username: profile.username,
    avatar: profile.avatar,
    avatarUrl,
    avatarDecorationUrl,
    clanTag: clanInfo?.tag || null,
    clanBadgeUrl: clanInfo?.badgeUrl || null,
    userMismatch,
    refreshedAt: new Date().toISOString(),
  };
}

exports.handler = async function handler(event) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const requestedSlot = event?.queryStringParameters?.slot;
  const direct = event?.queryStringParameters?.direct === "1";
  const force = event?.queryStringParameters?.force === "1";

  if (!clientId || !clientSecret) {
    return json(500, {
      error: "Missing DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET",
    });
  }

  if (requestedSlot && !["ev", "ey"].includes(requestedSlot)) {
    return json(400, {
      error: "Invalid slot. Use ev or ey.",
    });
  }

  try {
    if (requestedSlot) {
      const [storedToken, storedUserId, storedAvatarUrl, storedAvatarUpdatedAt, storedClanTag, storedClanBadgeUrl, storedAvatarDecorationUrl] = await Promise.all([
        getJson(`discord:${requestedSlot}:refresh_token`),
        getJson(`discord:${requestedSlot}:user_id`),
        getJson(`discord:${requestedSlot}:avatar_url`),
        getJson(`discord:${requestedSlot}:avatar_updated_at`),
        getJson(`discord:${requestedSlot}:clan_tag`),
        getJson(`discord:${requestedSlot}:clan_badge_url`),
        getJson(`discord:${requestedSlot}:avatar_decoration_url`),
      ]);

      const cachedUrl = storedAvatarUrl?.value || null;
      const cachedAt = Number(storedAvatarUpdatedAt?.value || 0);
      const cacheFresh = cachedUrl && cachedAt && Date.now() - cachedAt < AVATAR_CACHE_MS;

      if (!direct && !force && cacheFresh) {
        return json(200, {
          [requestedSlot]: {
            slot: requestedSlot,
            avatarUrl: cachedUrl,
            avatarDecorationUrl: storedAvatarDecorationUrl?.value || null,
            clanTag: storedClanTag?.value || null,
            clanBadgeUrl: storedClanBadgeUrl?.value || null,
            cached: true,
            refreshedAt: new Date(cachedAt).toISOString(),
          },
        });
      }

      if (direct && !force && cacheFresh) {
        return redirect(cachedUrl);
      }

      try {
        const resolved = await resolveSlotAvatar({
          slot: requestedSlot,
          refreshToken: storedToken?.value || process.env[`DISCORD_${requestedSlot.toUpperCase()}_REFRESH_TOKEN`],
          expectedUserId: storedUserId?.value || process.env[`DISCORD_${requestedSlot.toUpperCase()}_USER_ID`],
          clientId,
          clientSecret,
        });

        if (resolved.avatarUrl) {
          const cacheUpdates = [
            setJson(`discord:${requestedSlot}:avatar_url`, {
              value: resolved.avatarUrl,
            }),
            setJson(`discord:${requestedSlot}:avatar_updated_at`, {
              value: String(Date.now()),
            }),
          ];

          if (resolved.clanBadgeUrl) {
            cacheUpdates.push(
              setJson(`discord:${requestedSlot}:clan_tag`, {
                value: resolved.clanTag,
              }),
              setJson(`discord:${requestedSlot}:clan_badge_url`, {
                value: resolved.clanBadgeUrl,
              })
            );
          }

          if (resolved.avatarDecorationUrl) {
            cacheUpdates.push(
              setJson(`discord:${requestedSlot}:avatar_decoration_url`, {
                value: resolved.avatarDecorationUrl,
              })
            );
          }

          await Promise.all(cacheUpdates);
        }

        if (direct) {
          return redirect(resolved.avatarUrl || cachedUrl || defaultAvatarUrl(storedUserId?.value));
        }

        return json(200, {
          [requestedSlot]: resolved,
        });
      } catch (err) {
        if (direct) {
          return redirect(cachedUrl || defaultAvatarUrl(storedUserId?.value));
        }

        return json(500, {
          error: String(err.message || err),
          [requestedSlot]: {
            slot: requestedSlot,
            avatarUrl: cachedUrl || null,
          },
        });
      }
    }

    const [evStoredToken, eyStoredToken, evStoredUserId, eyStoredUserId] = await Promise.all([
      getJson("discord:ev:refresh_token"),
      getJson("discord:ey:refresh_token"),
      getJson("discord:ev:user_id"),
      getJson("discord:ey:user_id"),
    ]);

    const [ev, ey] = await Promise.all([
      resolveSlotAvatar({
        slot: "ev",
        refreshToken: evStoredToken?.value || process.env.DISCORD_EV_REFRESH_TOKEN,
        expectedUserId: evStoredUserId?.value || process.env.DISCORD_EV_USER_ID,
        clientId,
        clientSecret,
      }),
      resolveSlotAvatar({
        slot: "ey",
        refreshToken: eyStoredToken?.value || process.env.DISCORD_EY_REFRESH_TOKEN,
        expectedUserId: eyStoredUserId?.value || process.env.DISCORD_EY_USER_ID,
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

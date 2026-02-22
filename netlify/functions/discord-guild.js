const DISCORD_GUILD_PREVIEW_URL = "https://discord.com/api/v10/guilds";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "Content-Type",
    },
    body: JSON.stringify(body),
  };
}

function plain(statusCode, message) {
  return {
    statusCode,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "Content-Type",
    },
    body: message,
  };
}

function buildGuildIconUrl(guildId, iconHash) {
  if (!guildId || !iconHash) {
    return null;
  }

  const extension = iconHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.${extension}?size=256`;
}

function buildGuildBannerUrl(guildId, bannerHash) {
  if (!guildId || !bannerHash) {
    return null;
  }

  const extension = bannerHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/banners/${guildId}/${bannerHash}.${extension}?size=1024`;
}

async function fetchGuildInfo(guildId) {
  try {
    const response = await fetch(`${DISCORD_GUILD_PREVIEW_URL}/${guildId}/preview`, {
      headers: {
        "cache-control": "no-store",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    const iconUrl = buildGuildIconUrl(guildId, data.icon);
    const bannerUrl = buildGuildBannerUrl(guildId, data.banner);
    
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      icon_url: iconUrl,
      banner_url: bannerUrl,
      vanity_url_code: data.vanity_url_code,
      approximate_member_count: data.approximate_member_count,
      approximate_presence_count: data.approximate_presence_count,
    };
  } catch (err) {
    console.error(`Error fetching guild info for ${guildId}:`, err);
    return null;
  }
}

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "Content-Type",
      },
      body: "",
    };
  }

  const guildId = event.queryStringParameters?.id;

  if (!guildId) {
    return plain(400, "Missing guild id parameter");
  }

  try {
    const guildInfo = await fetchGuildInfo(guildId);
    
    if (!guildInfo) {
      return json(404, { error: "Guild not found or not accessible" });
    }

    return json(200, guildInfo);
  } catch (err) {
    console.error("Error in discord-guild handler:", err);
    return plain(500, "Internal server error");
  }
};

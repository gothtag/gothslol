const https = require('https');

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const token = process.env.DISCORD_BOT_TOKEN;
    const headers = {
      'User-Agent': 'goths.lol',
      'Authorization': `Bot ${token}`
    };
    
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: null, error: e.message });
        }
      });
    }).on('error', reject);
  });
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
  return `https://cdn.discordapp.com/discovery-splashes/${guildId}/${bannerHash}.${extension}?size=1024`;
}

exports.handler = async (event) => {
  const headers = {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "Content-Type",
  };

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  const guildId = event.queryStringParameters?.id;

  if (!guildId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing guild id parameter" }),
    };
  }

  try {
    // Try to get full guild info with counts
    let result = await makeRequest(`https://discord.com/api/v10/guilds/${guildId}?with_counts=true`);
    
    // Fallback to preview endpoint if not accessible
    if (result.status !== 200 || !result.data) {
      result = await makeRequest(`https://discord.com/api/v10/guilds/${guildId}/preview`);
    }
    if (result.status !== 200 || !result.data) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Guild not found or not accessible" }),
      };
    }

    const data = result.data;
    const iconUrl = buildGuildIconUrl(guildId, data.icon);
    const bannerUrl = buildGuildBannerUrl(guildId, data.discovery_splash);
    
    // Try to get clan info from a guild member (use a known user ID)
    let clanTag = null;
    let clanBadge = null;
    
    const memberUserId = event.queryStringParameters?.memberUserId || "323177897575579660";
    const memberResult = await makeRequest(`https://discord.com/api/v10/guilds/${guildId}/members/${memberUserId}`);
    
    if (memberResult.status === 200 && memberResult.data) {
      const memberData = memberResult.data;
      // Check for clan in member's avatar decoration data or clan field
      if (memberData.avatar_decoration_data?.sku_id) {
        // Member has clan, extract from their profile in this guild context
        const userResult = await makeRequest(`https://discord.com/api/v10/users/${memberUserId}/profile?guild_id=${guildId}`);
        if (userResult.status === 200 && userResult.data) {
          const profile = userResult.data;
          if (profile.guild_member_profile?.clan_tag) {
            clanTag = profile.guild_member_profile.clan_tag;
            clanBadge = profile.guild_member_profile.clan_badge ? `https://cdn.discordapp.com/clan-badges/${profile.guild_member_profile.clan_badge}.png` : null;
          } else if (profile.user_profile?.clan_tag) {
            clanTag = profile.user_profile.clan_tag;
            clanBadge = profile.user_profile.clan_badge ? `https://cdn.discordapp.com/clan-badges/${profile.user_profile.clan_badge}.png` : null;
          }
        }
      }
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        id: data.id,
        name: data.name,
        description: data.description,
        icon_url: iconUrl,
        banner_url: bannerUrl,
        vanity_url_code: data.vanity_url_code,
        clan_tag: clanTag,
        clan_badge: clanBadge,
        approximate_member_count: data.approximate_member_count,
        approximate_presence_count: data.approximate_presence_count,
      }),
    };
  } catch (err) {
    console.error("Error in discord-guild handler:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};

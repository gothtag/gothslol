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
    
    // Get clan info from invite endpoint - WITHOUT bot auth for clan data
    let clanTag = null;
    let clanBadge = null;
    
    const inviteCode = event.queryStringParameters?.invite || "gothtag";
    try {
      // Make request without bot auth - clan data may only be in public response
      const inviteUrl = `https://discord.com/api/v10/invites/${inviteCode}?with_counts=true&with_expiration=true`;
      const inviteResult = await new Promise((resolve, reject) => {
        https.get(inviteUrl, { headers: { 'User-Agent': 'goths.lol' } }, (res) => {
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
      
      console.log("Invite API Status:", inviteResult.status);
      console.log("Full Invite Response:", JSON.stringify(inviteResult.data, null, 2));
      
      if (inviteResult.status === 200 && inviteResult.data) {
        console.log("Invite data keys:", Object.keys(inviteResult.data));
        
        if (inviteResult.data.guild) {
          console.log("Guild keys:", Object.keys(inviteResult.data.guild));
          console.log("Guild clan:", inviteResult.data.guild.clan);
          
          const guild = inviteResult.data.guild;
          
          // Check all possible field structures
          if (guild.clan) {
            clanTag = guild.clan.tag;
            clanBadge = guild.clan.badge ? `https://cdn.discordapp.com/clan-badges/${guild.clan.badge}.png` : null;
            console.log("Found clan:", { tag: clanTag, badge: clanBadge });
          } else if (guild.clan_tag) {
            clanTag = guild.clan_tag;
            clanBadge = guild.clan_badge ? `https://cdn.discordapp.com/clan-badges/${guild.clan_badge}.png` : null;
            console.log("Found clan_tag:", { tag: clanTag, badge: clanBadge });
          } else {
            console.log("No clan data in guild object, guild keys:", Object.keys(guild));
          }
        }
      }
    } catch (inviteErr) {
      console.error("Failed to fetch invite data:", inviteErr);
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

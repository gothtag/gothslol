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
    
    // Get clan info from guild members - clan tags are USER properties, not guild properties!
    let clanTag = null;
    let clanBadge = null;
    
    console.log("=== Fetching Guild Members for Clan Tag ===");
    console.log("Guild ID:", guildId);
    
    try {
      // Fetch guild members - clan tags are stored in user.clan or user.primary_guild
      const membersResult = await makeRequest(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`);
      
      console.log("Members API Status:", membersResult.status);
      
      if (membersResult.status === 200 && membersResult.data && Array.isArray(membersResult.data)) {
        console.log(`Found ${membersResult.data.length} members, searching for clan tag...`);
        
        // Look for a member whose clan.identity_guild_id matches this guild
        for (const member of membersResult.data) {
          if (!member.user) continue;
          
          // Check user.clan field
          if (member.user.clan && member.user.clan.identity_guild_id === guildId) {
            clanTag = member.user.clan.tag;
            clanBadge = member.user.clan.badge ? `https://cdn.discordapp.com/badge-icons/${member.user.clan.badge}.png` : null;
            console.log("✓ Found clan tag from user.clan:", { tag: clanTag, badge: member.user.clan.badge });
            break;
          }
          
          // Check user.primary_guild field (alternative naming)
          if (member.user.primary_guild && member.user.primary_guild.identity_guild_id === guildId) {
            clanTag = member.user.primary_guild.tag;
            clanBadge = member.user.primary_guild.badge ? `https://cdn.discordapp.com/badge-icons/${member.user.primary_guild.badge}.png` : null;
            console.log("✓ Found clan tag from user.primary_guild:", { tag: clanTag, badge: member.user.primary_guild.badge });
            break;
          }
        }
        
        if (!clanTag) {
          console.log("✗ No members found with clan.identity_guild_id matching this guild");
          console.log("Sample member structure:", JSON.stringify(membersResult.data[0], null, 2));
        }
      } else {
        console.log("Failed to fetch members or invalid response");
        console.log("Response data:", membersResult.data);
      }
    } catch (membersErr) {
      console.error("Failed to fetch guild members:", membersErr);
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

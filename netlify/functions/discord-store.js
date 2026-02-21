const { getStore: getBlobsStore } = require("@netlify/blobs");

const STORE_NAME = "gothslol-discord";

function store() {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_API_TOKEN;

  if (!siteID || !token) {
    throw new Error("Missing NETLIFY_SITE_ID or NETLIFY_API_TOKEN");
  }

  return getBlobsStore({
    name: STORE_NAME,
    siteID,
    token,
  });
}

async function getJson(key) {
  const value = await store().get(key);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (_err) {
    return null;
  }
}

async function setJson(key, data) {
  const payload = JSON.stringify(data);
  await store().set(key, payload, { metadata: { updatedAt: new Date().toISOString() } });
}

module.exports = {
  getJson,
  setJson,
};

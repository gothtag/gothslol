const { getStore: getBlobsStore } = require("@netlify/blobs");

const STORE_NAME = "gothslol-discord";

function store() {
  return getBlobsStore(STORE_NAME);
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

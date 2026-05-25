const fs = require("node:fs");
const path = require("node:path");
const { DATA_DIR, ADDON_NAME } = require("./constants");

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(`[metadata-store] failed reading ${filePath}: ${error.message}`);
    }
    return fallback;
  }
}

function loadCatalog(dataDir = DATA_DIR) {
  const catalog = readJson(path.join(dataDir, "catalog.json"), { metas: [] });
  if (!Array.isArray(catalog.metas)) return { metas: [] };
  return catalog;
}

function loadMeta(slug, dataDir = DATA_DIR) {
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return null;
  return readJson(path.join(dataDir, "meta", `${slug}.json`), null);
}

function encodePathSegment(filename) {
  return encodeURIComponent(filename).replace(/%2F/gi, "");
}

function buildStreamForMeta(meta, baseUrl) {
  if (!meta || !meta.videoFilename) return null;
  return {
    title: "NL Gesproken",
    name: ADDON_NAME,
    url: `${baseUrl}/nl-gesproken/${encodePathSegment(meta.videoFilename)}`
  };
}

module.exports = {
  loadCatalog,
  loadMeta,
  buildStreamForMeta
};

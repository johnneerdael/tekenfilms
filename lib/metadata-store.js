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

function loadSeriesCatalog(dataDir = DATA_DIR) {
  const catalog = readJson(path.join(dataDir, "series-catalog.json"), { metas: [] });
  if (!Array.isArray(catalog.metas)) return { metas: [] };
  return catalog;
}

function loadMeta(slug, dataDir = DATA_DIR) {
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return null;
  return readJson(path.join(dataDir, "meta", `${slug}.json`), null);
}

function encodeRelativePath(filename) {
  return String(filename || "")
    .split("/")
    .filter(segment => segment && segment !== "." && segment !== "..")
    .map(segment => encodeURIComponent(segment))
    .join("/");
}

function buildStreamForMeta(meta, baseUrl) {
  if (!meta || !meta.videoFilename) return null;
  return {
    title: "NL Gesproken",
    name: ADDON_NAME,
    url: `${baseUrl}/nl-gesproken/${encodeRelativePath(meta.videoFilename)}`
  };
}

function buildStreamForVideo(meta, videoId, baseUrl) {
  if (!meta) return null;
  if (meta.type !== "series") return buildStreamForMeta(meta, baseUrl);
  const video = (meta.videos || []).find(item => item.id === videoId);
  if (!video || !video.videoFilename) return null;
  return {
    title: `${video.title || "Aflevering"} - NL Gesproken`,
    name: ADDON_NAME,
    url: `${baseUrl}/nl-gesproken/${encodeRelativePath(video.videoFilename)}`
  };
}

module.exports = {
  loadCatalog,
  loadSeriesCatalog,
  loadMeta,
  buildStreamForMeta,
  buildStreamForVideo
};

const path = require("node:path");

const ADDON_ID = "org.nexio.tekenfilms";
const ADDON_NAME = "Tekenfilms";
const CATALOG_ID = "tekenfilms_nl";
const CATALOG_NAME = "Tekenfilms (Nederlands)";
const SERIES_CATALOG_ID = "tekenfilms_series_nl";
const SERIES_CATALOG_NAME = "Series (Nederlands)";
const ID_PREFIX = "tekenfilms:";
const SUPPORTED_VIDEO_EXTENSIONS = [".avi", ".mkv", ".mp4", ".m4v"];
const DEFAULT_PORT = 7010;

const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const META_DIR = path.join(DATA_DIR, "meta");
const POSTER_DIR = path.join(DATA_DIR, "posters");
const NL_DIR = path.join(ROOT_DIR, "NL");

function resolveVideoDir(value, rootDir = ROOT_DIR) {
  if (!value) return path.join(rootDir, "NL");
  return path.isAbsolute(value) ? value : path.join(rootDir, value);
}

function slugPathAlias(value) {
  return String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "media";
}

function parseVideoDirEntry(entry, index, rootDir = ROOT_DIR) {
  const trimmed = String(entry || "").trim();
  if (!trimmed) return null;
  const equalsIndex = trimmed.indexOf("=");
  if (equalsIndex > 0) {
    const alias = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim();
    if (!alias || !value) return null;
    return { alias: slugPathAlias(alias), path: resolveVideoDir(value, rootDir) };
  }
  const resolved = resolveVideoDir(trimmed, rootDir);
  return { alias: index === 0 ? null : slugPathAlias(resolved), path: resolved };
}

function resolveVideoDirs(value = process.env.VIDEO_DIRS, rootDir = ROOT_DIR) {
  if (!value) return [{ alias: null, path: resolveVideoDir(process.env.VIDEO_DIR, rootDir) }];
  const dirs = String(value)
    .split(",")
    .map((entry, index) => parseVideoDirEntry(entry, index, rootDir))
    .filter(Boolean);
  return dirs.length ? dirs : [{ alias: null, path: resolveVideoDir(process.env.VIDEO_DIR, rootDir) }];
}

const VIDEO_DIR = resolveVideoDir(process.env.VIDEO_DIR);
const VIDEO_DIRS = resolveVideoDirs();

function normalizeBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

function getBaseUrl() {
  const port = process.env.PORT || DEFAULT_PORT;
  return normalizeBaseUrl(process.env.BASE_URL || `http://127.0.0.1:${port}`);
}

module.exports = {
  ADDON_ID,
  ADDON_NAME,
  CATALOG_ID,
  CATALOG_NAME,
  SERIES_CATALOG_ID,
  SERIES_CATALOG_NAME,
  ID_PREFIX,
  SUPPORTED_VIDEO_EXTENSIONS,
  DEFAULT_PORT,
  ROOT_DIR,
  DATA_DIR,
  META_DIR,
  POSTER_DIR,
  NL_DIR,
  VIDEO_DIR,
  VIDEO_DIRS,
  resolveVideoDir,
  resolveVideoDirs,
  normalizeBaseUrl,
  getBaseUrl
};

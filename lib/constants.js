const path = require("node:path");

const ADDON_ID = "org.nexio.tekenfilms";
const ADDON_NAME = "Tekenfilms";
const CATALOG_ID = "tekenfilms_nl";
const CATALOG_NAME = "Tekenfilms (Nederlands)";
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

const VIDEO_DIR = resolveVideoDir(process.env.VIDEO_DIR);

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
  ID_PREFIX,
  SUPPORTED_VIDEO_EXTENSIONS,
  DEFAULT_PORT,
  ROOT_DIR,
  DATA_DIR,
  META_DIR,
  POSTER_DIR,
  NL_DIR,
  VIDEO_DIR,
  resolveVideoDir,
  normalizeBaseUrl,
  getBaseUrl
};

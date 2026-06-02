const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ADDON_ID,
  CATALOG_ID,
  ID_PREFIX,
  SUPPORTED_VIDEO_EXTENSIONS,
  normalizeBaseUrl,
  resolveVideoDirs
} = require("../lib/constants");

test("exports stable addon constants", () => {
  assert.equal(ADDON_ID, "org.nexio.tekenfilms");
  assert.equal(CATALOG_ID, "tekenfilms_nl");
  assert.equal(ID_PREFIX, "tekenfilms:");
  assert.deepEqual(SUPPORTED_VIDEO_EXTENSIONS, [".avi", ".mkv", ".mp4", ".m4v"]);
});

test("normalizes base urls without trailing slashes", () => {
  assert.equal(normalizeBaseUrl("https://tekenfilms.nexioapp.org/"), "https://tekenfilms.nexioapp.org");
  assert.equal(normalizeBaseUrl("http://127.0.0.1:7010///"), "http://127.0.0.1:7010");
});

test("resolves multiple video directories with optional aliases", () => {
  assert.deepEqual(resolveVideoDirs("NL,nas=NAS", "/app"), [
    { alias: null, path: "/app/NL" },
    { alias: "nas", path: "/app/NAS" }
  ]);
  assert.deepEqual(resolveVideoDirs("/app/NL,/app/NAS", "/app"), [
    { alias: null, path: "/app/NL" },
    { alias: "nas", path: "/app/NAS" }
  ]);
});

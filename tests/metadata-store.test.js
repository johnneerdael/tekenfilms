const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  loadCatalog,
  loadMeta,
  buildStreamForMeta
} = require("../lib/metadata-store");

function makeTempData() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tekenfilms-store-"));
  fs.mkdirSync(path.join(dir, "meta"));
  fs.writeFileSync(path.join(dir, "catalog.json"), JSON.stringify({
    metas: [
      {
        id: "tekenfilms:frozen-2013",
        type: "movie",
        name: "Frozen",
        poster: "https://image.tmdb.org/t/p/w500/poster.jpg"
      }
    ]
  }));
  fs.writeFileSync(path.join(dir, "meta", "frozen-2013.json"), JSON.stringify({
    id: "tekenfilms:frozen-2013",
    type: "movie",
    name: "Frozen",
    videoFilename: "Frozen.2013.BluRay.NL.avi"
  }));
  return dir;
}

test("loads generated catalog", () => {
  const dataDir = makeTempData();
  const catalog = loadCatalog(dataDir);
  assert.equal(catalog.metas.length, 1);
  assert.equal(catalog.metas[0].id, "tekenfilms:frozen-2013");
});

test("returns empty catalog when generated file is missing", () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "tekenfilms-store-empty-"));
  assert.deepEqual(loadCatalog(dataDir), { metas: [] });
});

test("loads meta by slug and returns null for missing ids", () => {
  const dataDir = makeTempData();
  assert.equal(loadMeta("frozen-2013", dataDir).name, "Frozen");
  assert.equal(loadMeta("missing", dataDir), null);
});

test("builds encoded direct stream urls", () => {
  const stream = buildStreamForMeta({
    videoFilename: "Alice in Wonderland (1951).m4v"
  }, "https://tekenfilms.nexioapp.org");

  assert.deepEqual(stream, {
    title: "NL Gesproken",
    name: "Tekenfilms",
    url: "https://tekenfilms.nexioapp.org/nl-gesproken/Alice%20in%20Wonderland%20(1951).m4v"
  });
});

test("builds encoded stream urls for videos in release subfolders", () => {
  const stream = buildStreamForMeta({
    videoFilename: "Aladdin.1992.2160p.DSNP.WEB-DL.DUAL-DUTCHFAM/aladdin.1992.2160p.dsnp.web-dl.dual-dutchfam.mkv"
  }, "https://tekenfilms.nexioapp.org");

  assert.equal(
    stream.url,
    "https://tekenfilms.nexioapp.org/nl-gesproken/Aladdin.1992.2160p.DSNP.WEB-DL.DUAL-DUTCHFAM/aladdin.1992.2160p.dsnp.web-dl.dual-dutchfam.mkv"
  );
});

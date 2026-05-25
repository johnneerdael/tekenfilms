const test = require("node:test");
const assert = require("node:assert/strict");

const { manifest, createHandlers } = require("../addon");

test("manifest exposes one no-configuration movie catalog", () => {
  assert.equal(manifest.id, "org.nexio.tekenfilms");
  assert.equal(manifest.name, "Tekenfilms");
  assert.deepEqual(manifest.types, ["movie"]);
  assert.equal(manifest.config, undefined);
  assert.equal(manifest.behaviorHints.configurable, false);
  assert.equal(manifest.behaviorHints.configurationRequired, false);
  assert.deepEqual(manifest.catalogs, [
    {
      id: "tekenfilms_nl",
      type: "movie",
      name: "Tekenfilms (Nederlands)"
    }
  ]);
});

test("catalog handler returns generated metas for the rail", async () => {
  const handlers = createHandlers({
    getBaseUrl: () => "https://tekenfilms.nexioapp.org",
    loadCatalog: () => ({ metas: [{ id: "tekenfilms:frozen-2013", type: "movie", name: "Frozen" }] }),
    loadMeta: () => null
  });

  const result = await handlers.catalog({ type: "movie", id: "tekenfilms_nl" });
  assert.deepEqual(result, {
    metas: [{ id: "tekenfilms:frozen-2013", type: "movie", name: "Frozen" }],
    cacheMaxAge: 86400
  });
});

test("catalog handler ignores unknown catalogs", async () => {
  const handlers = createHandlers();
  assert.deepEqual(await handlers.catalog({ type: "series", id: "other" }), { metas: [] });
});

test("meta handler reads generated meta", async () => {
  const handlers = createHandlers({
    loadMeta: slug => slug === "frozen-2013" ? { id: "tekenfilms:frozen-2013", type: "movie", name: "Frozen" } : null
  });

  assert.deepEqual(await handlers.meta({ type: "movie", id: "tekenfilms:frozen-2013" }), {
    meta: { id: "tekenfilms:frozen-2013", type: "movie", name: "Frozen" },
    cacheMaxAge: 86400
  });
  assert.deepEqual(await handlers.meta({ type: "movie", id: "tt2294629" }), { meta: null });
});

test("stream handler returns one direct stream", async () => {
  const handlers = createHandlers({
    getBaseUrl: () => "https://tekenfilms.nexioapp.org",
    loadMeta: slug => slug === "frozen-2013" ? {
      id: "tekenfilms:frozen-2013",
      videoFilename: "Frozen.2013.BluRay.NL.avi"
    } : null
  });

  assert.deepEqual(await handlers.stream({ type: "movie", id: "tekenfilms:frozen-2013" }), {
    streams: [
      {
        title: "NL Gesproken",
        name: "Tekenfilms",
        url: "https://tekenfilms.nexioapp.org/nl-gesproken/Frozen.2013.BluRay.NL.avi"
      }
    ],
    cacheMaxAge: 86400
  });
});

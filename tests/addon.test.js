const test = require("node:test");
const assert = require("node:assert/strict");

const { manifest, createHandlers } = require("../addon");

test("manifest exposes no-configuration movie and series catalogs", () => {
  assert.equal(manifest.id, "org.nexio.tekenfilms");
  assert.equal(manifest.name, "Tekenfilms");
  assert.deepEqual(manifest.types, ["movie", "series"]);
  assert.equal(manifest.config, undefined);
  assert.equal(manifest.behaviorHints.configurable, false);
  assert.equal(manifest.behaviorHints.configurationRequired, false);
  assert.deepEqual(manifest.catalogs, [
    {
      id: "tekenfilms_nl",
      type: "movie",
      name: "Tekenfilms (Nederlands)"
    },
    {
      id: "tekenfilms_series_nl",
      type: "series",
      name: "Series (Nederlands)"
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

test("series catalog handler returns generated series metas", async () => {
  const handlers = createHandlers({
    loadSeriesCatalog: () => ({ metas: [{ id: "tt32145678", type: "series", name: "Asterix" }] })
  });

  assert.deepEqual(await handlers.catalog({ type: "series", id: "tekenfilms_series_nl" }), {
    metas: [{ id: "tt32145678", type: "series", name: "Asterix" }],
    cacheMaxAge: 86400
  });
});

test("meta handler reads generated meta", async () => {
  const handlers = createHandlers({
    loadMeta: slug => slug === "tt2294629" ? { id: "tt2294629", type: "movie", name: "Frozen" } : null
  });

  assert.deepEqual(await handlers.meta({ type: "movie", id: "tt2294629" }), {
    meta: { id: "tt2294629", type: "movie", name: "Frozen" },
    cacheMaxAge: 86400
  });
  assert.deepEqual(await handlers.meta({ type: "movie", id: "bad-id" }), { meta: null });
});

test("stream handler returns one direct stream", async () => {
  const handlers = createHandlers({
    getBaseUrl: () => "https://tekenfilms.nexioapp.org",
    loadMeta: slug => slug === "tt2294629" ? {
      id: "tt2294629",
      videoFilename: "Frozen.2013.1080p.BluRay.NL.H264-DUTCHFAM.mkv"
    } : null
  });

  assert.deepEqual(await handlers.stream({ type: "movie", id: "tt2294629" }), {
    streams: [
      {
        title: "NL Gesproken | 1080p | BluRay | AVC",
        name: "Tekenfilms",
        description: [
          "Video: 1080p | BluRay | AVC | MKV",
          "Audio: Dutch",
          "Release: DUTCHFAM",
          "File: Frozen.2013.1080p.BluRay.NL.H264-DUTCHFAM.mkv"
        ].join("\n"),
        behaviorHints: {
          filename: "Frozen.2013.1080p.BluRay.NL.H264-DUTCHFAM.mkv",
          bingeGroup: "tt2294629|1080p|BluRay|AVC|DUTCHFAM"
        },
        url: "https://tekenfilms.nexioapp.org/nl-gesproken/Frozen.2013.1080p.BluRay.NL.H264-DUTCHFAM.mkv"
      }
    ],
    cacheMaxAge: 86400
  });
});

test("series stream handler returns episode stream", async () => {
  const handlers = createHandlers({
    getBaseUrl: () => "https://tekenfilms.nexioapp.org",
    loadMeta: slug => slug === "tt32145678" ? {
      id: "tt32145678",
      type: "series",
      videos: [{ id: "tt32145678:1:1", title: "Episode Een", videoFilename: "Asterix.S01/Asterix.S01E01.1080p.WEB-DL.H265.mkv" }]
    } : null
  });

  const result = await handlers.stream({ type: "series", id: "tt32145678:1:1" });
  assert.equal(result.streams[0].title, "Episode Een - NL Gesproken | 1080p | WEB-DL | HEVC");
  assert.equal(result.streams[0].behaviorHints.filename, "Asterix.S01/Asterix.S01E01.1080p.WEB-DL.H265.mkv");
  assert.equal(result.streams[0].url, "https://tekenfilms.nexioapp.org/nl-gesproken/Asterix.S01/Asterix.S01E01.1080p.WEB-DL.H265.mkv");
});

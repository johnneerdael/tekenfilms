const test = require("node:test");
const assert = require("node:assert/strict");

const {
  applyManualMatch,
  chooseTmdbResult,
  buildStremioMeta,
  buildCatalogMeta,
  loadApiBlueprints
} = require("../scripts/generate-metadata");

test("applies manual match by filename", () => {
  const parsed = { filename: "De Reddertjes in Kangeroeland.m4v", title: "De Reddertjes in Kangeroeland", year: null };
  const manualMatches = {
    "De Reddertjes in Kangeroeland.m4v": { tmdbId: 11135, title: "The Rescuers Down Under", year: 1990 }
  };

  assert.deepEqual(applyManualMatch(parsed, manualMatches), {
    filename: "De Reddertjes in Kangeroeland.m4v",
    title: "The Rescuers Down Under",
    year: 1990,
    tmdbId: 11135
  });
});

test("chooses exact year match from TMDB results", () => {
  const result = chooseTmdbResult(
    { title: "Frozen", year: 2013 },
    [
      { id: 1, title: "Frozen", release_date: "2010-02-05" },
      { id: 2, title: "Frozen", release_date: "2013-11-27" }
    ]
  );

  assert.equal(result.id, 2);
});

test("rejects ambiguous TMDB results", () => {
  assert.equal(chooseTmdbResult(
    { title: "Frozen", year: null },
    [
      { id: 1, title: "Frozen", release_date: "2010-02-05" },
      { id: 2, title: "Frozen", release_date: "2013-11-27" }
    ]
  ), null);
});

test("builds full Stremio metadata", () => {
  const meta = buildStremioMeta({
    parsed: { filename: "Frozen.2013.BluRay.NL.avi", title: "Frozen", year: 2013 },
    details: {
      id: 109445,
      imdb_id: "tt2294629",
      title: "Frozen",
      original_title: "Frozen",
      overview: "Wanneer een koninkrijk vast komt te zitten in eeuwige winter...",
      release_date: "2013-11-27",
      runtime: 102,
      poster_path: "/poster.jpg",
      backdrop_path: "/backdrop.jpg",
      genres: [{ name: "Animatie" }, { name: "Familie" }],
      credits: {
        cast: [{ name: "Kristen Bell" }],
        crew: [{ job: "Director", name: "Chris Buck" }]
      },
      images: {
        logos: [{ file_path: "/logo.png", iso_639_1: "nl" }]
      }
    }
  });

  assert.equal(meta.id, "tekenfilms:frozen-2013");
  assert.equal(meta.name, "Frozen");
  assert.equal(meta.videoFilename, "Frozen.2013.BluRay.NL.avi");
  assert.equal(meta.poster, "https://image.tmdb.org/t/p/w500/poster.jpg");
  assert.equal(meta.logo, "https://image.tmdb.org/t/p/w500/logo.png");
  assert.equal(meta.background, "https://image.tmdb.org/t/p/original/backdrop.jpg");
  assert.equal(meta.imdbId, "tt2294629");
  assert.deepEqual(meta.genres, ["Animatie", "Familie"]);
  assert.deepEqual(meta.behaviorHints, { defaultVideoId: "tekenfilms:frozen-2013" });
});

test("builds lightweight catalog metadata", () => {
  const catalogMeta = buildCatalogMeta({
    id: "tekenfilms:frozen-2013",
    type: "movie",
    name: "Frozen",
    poster: "https://image.tmdb.org/t/p/w500/poster.jpg",
    background: "https://image.tmdb.org/t/p/original/backdrop.jpg",
    description: "Beschrijving",
    releaseInfo: "2013"
  });

  assert.deepEqual(Object.keys(catalogMeta).sort(), [
    "background",
    "description",
    "id",
    "name",
    "poster",
    "releaseInfo",
    "type"
  ]);
});

test("loads API blueprint defaults", () => {
  const blueprints = loadApiBlueprints();
  assert.equal(blueprints.tmdbServerUrl, "https://api.themoviedb.org");
  assert.equal(blueprints.imdbApiBaseUrl, "https://api.imdbapi.dev");
});

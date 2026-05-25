const test = require("node:test");
const assert = require("node:assert/strict");

const {
  addMetaOrDuplicate,
  applyManualMatch,
  buildQueryCandidates,
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

test("chooses near year for exact title release date differences", () => {
  const result = chooseTmdbResult(
    { title: "De Drie Caballeros", year: 1945 },
    [{ id: 15947, title: "De Drie Caballeros", release_date: "1944-12-21" }]
  );

  assert.equal(result.id, 15947);
});

test("chooses single exact title without year", () => {
  const result = chooseTmdbResult(
    { title: "101 Echte Dalmatiërs", year: null },
    [
      { id: 11674, title: "101 Echte Dalmatiërs", release_date: "1996-11-27" },
      { id: 10481, title: "102 Echte Dalmatiërs", release_date: "2000-10-07" }
    ]
  );

  assert.equal(result.id, 11674);
});

test("chooses dominant exact title without year", () => {
  const result = chooseTmdbResult(
    { title: "Chicken Little", year: null },
    [
      { id: 9982, title: "Chicken Little", release_date: "2005-11-04", popularity: 6.0 },
      { id: 928883, title: "Chicken Little", release_date: "1998-02-23", popularity: 1.0 },
      { id: 64648, title: "Chicken Little", release_date: "1943-12-17", popularity: 0.5 }
    ]
  );

  assert.equal(result.id, 9982);
});

test("chooses unique exact title even when filename year is wrong", () => {
  const result = chooseTmdbResult(
    { title: "Suske en Wiske De Duistere Diamant", year: 2014 },
    [{ id: 56344, title: "Suske en Wiske: De duistere diamant", release_date: "2004-02-14" }]
  );

  assert.equal(result.id, 56344);
});

test("builds query candidates for known title variants", () => {
  assert.ok(buildQueryCandidates("Meet the Robonsons").includes("Meet the Robinsons"));
  assert.ok(buildQueryCandidates("Oliver en Co").includes("Oliver & Co"));
  assert.ok(buildQueryCandidates("De Reddertjes in Kangeroeland").includes("De Reddertjes in Kangoeroeland"));
  assert.ok(buildQueryCandidates("Tijgetjes Film").includes("The Tigger Movie"));
});

test("duplicate sources are reported without failing generation", () => {
  const metas = [{ id: "tekenfilms:toy-story-1995", videoFilename: "Toy Story (1995).m4v" }];
  const seenIds = new Map([["tekenfilms:toy-story-1995", "Toy Story (1995).m4v"]]);
  const duplicates = [];

  const added = addMetaOrDuplicate(
    { id: "tekenfilms:toy-story-1995", videoFilename: "Toy.Story.1995.DVD.NL.avi" },
    seenIds,
    metas,
    duplicates
  );

  assert.equal(added, false);
  assert.equal(metas.length, 1);
  assert.equal(duplicates[0].filename, "Toy.Story.1995.DVD.NL.avi");
  assert.equal(duplicates[0].conflictsWith, "Toy Story (1995).m4v");
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
    logo: "https://image.tmdb.org/t/p/w500/logo.png",
    background: "https://image.tmdb.org/t/p/original/backdrop.jpg",
    description: "Beschrijving",
    releaseInfo: "2013"
  });

  assert.deepEqual(Object.keys(catalogMeta).sort(), [
    "background",
    "description",
    "id",
    "logo",
    "name",
    "poster",
    "releaseInfo",
    "type"
  ]);
  assert.equal(catalogMeta.logo, "https://image.tmdb.org/t/p/w500/logo.png");
});

test("loads API blueprint defaults", () => {
  const blueprints = loadApiBlueprints();
  assert.equal(blueprints.tmdbServerUrl, "https://api.themoviedb.org");
  assert.equal(blueprints.imdbApiBaseUrl, "https://api.imdbapi.dev");
});

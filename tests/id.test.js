const test = require("node:test");
const assert = require("node:assert/strict");

const { slugify, buildMovieId, idToSlug } = require("../lib/id");

test("slugifies Dutch and punctuation-heavy titles", () => {
  assert.equal(slugify("Poeh's Lollifanten Film"), "poehs-lollifanten-film");
  assert.equal(slugify("Suske en Wiske: De Duistere Diamant"), "suske-en-wiske-de-duistere-diamant");
});

test("builds stable movie ids", () => {
  assert.equal(buildMovieId("Frozen", 2013), "tekenfilms:frozen-2013");
  assert.equal(idToSlug("tekenfilms:frozen-2013"), "frozen-2013");
});

test("uses IMDb ids directly as metadata slugs", () => {
  assert.equal(idToSlug("tt2294629"), "tt2294629");
  assert.equal(idToSlug("tmdb:109445"), "tmdb-109445");
});

const test = require("node:test");
const assert = require("node:assert/strict");

const { parseVideoFilename, isSupportedVideoFile } = require("../lib/filename-parser");

test("detects supported video files", () => {
  assert.equal(isSupportedVideoFile("Frozen.2013.BluRay.NL.avi"), true);
  assert.equal(isSupportedVideoFile("Nemo (2003).mp4"), true);
  assert.equal(isSupportedVideoFile("poster.jpg"), false);
});

test("parses dotted release filenames", () => {
  assert.deepEqual(parseVideoFilename("Frozen.2013.BluRay.NL.avi"), {
    filename: "Frozen.2013.BluRay.NL.avi",
    title: "Frozen",
    year: 2013,
    extension: ".avi"
  });
});

test("parses title year filenames", () => {
  assert.deepEqual(parseVideoFilename("Alice in Wonderland (1951).m4v"), {
    filename: "Alice in Wonderland (1951).m4v",
    title: "Alice in Wonderland",
    year: 1951,
    extension: ".m4v"
  });
});

test("keeps title when year is absent", () => {
  assert.deepEqual(parseVideoFilename("De Reddertjes in Kangeroeland.m4v"), {
    filename: "De Reddertjes in Kangeroeland.m4v",
    title: "De Reddertjes in Kangeroeland",
    year: null,
    extension: ".m4v"
  });
});

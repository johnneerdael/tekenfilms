const path = require("node:path");
const { SUPPORTED_VIDEO_EXTENSIONS } = require("./constants");

const RELEASE_TAGS = [
  "bluray",
  "blu-ray",
  "dvd",
  "dvdrip",
  "webrip",
  "web-dl",
  "nl",
  "nld",
  "dutch"
];

function isSupportedVideoFile(filename) {
  return SUPPORTED_VIDEO_EXTENSIONS.includes(path.extname(filename).toLowerCase());
}

function cleanTitle(rawTitle) {
  return rawTitle
    .replace(/[._]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripReleaseTags(parts) {
  const kept = [];
  for (const part of parts) {
    const normalized = part.toLowerCase();
    if (RELEASE_TAGS.includes(normalized)) break;
    kept.push(part);
  }
  return kept;
}

function parseVideoFilename(filename) {
  const extension = path.extname(filename).toLowerCase();
  const basename = path.basename(filename, extension);
  const episodeMatch = basename.match(/^(.*?)S(\d{1,2})E(\d{1,2})(?:[.\s]+(\d{4}))?/i);

  if (episodeMatch) {
    return {
      filename,
      title: cleanTitle(episodeMatch[1]),
      year: episodeMatch[4] ? Number(episodeMatch[4]) : null,
      season: Number(episodeMatch[2]),
      episode: Number(episodeMatch[3]),
      mediaType: "series",
      extension
    };
  }

  const parenthesizedYear = basename.match(/^(.*)\((\d{4})\)\s*$/);

  if (parenthesizedYear) {
    return {
      filename,
      title: cleanTitle(parenthesizedYear[1]),
      year: Number(parenthesizedYear[2]),
      extension
    };
  }

  const parts = basename.split(/[.\s]+/).filter(Boolean);
  const yearIndex = parts.findIndex(part => /^\d{4}$/.test(part));

  if (yearIndex >= 0) {
    const titleParts = stripReleaseTags(parts.slice(0, yearIndex));
    return {
      filename,
      title: cleanTitle(titleParts.join(" ")),
      year: Number(parts[yearIndex]),
      extension
    };
  }

  return {
    filename,
    title: cleanTitle(basename),
    year: null,
    extension
  };
}

module.exports = {
  isSupportedVideoFile,
  parseVideoFilename
};

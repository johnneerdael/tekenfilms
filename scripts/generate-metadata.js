#!/usr/bin/env node

require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const {
  DATA_DIR,
  META_DIR,
  NL_DIR,
  ROOT_DIR
} = require("../lib/constants");
const { parseVideoFilename, isSupportedVideoFile } = require("../lib/filename-parser");
const { buildMovieId, idToSlug } = require("../lib/id");

function loadApiBlueprints(rootDir = ROOT_DIR) {
  const tmdbBlueprint = readJson(path.join(rootDir, "tmdb.json"), {});
  const imdbYaml = fs.readFileSync(path.join(rootDir, "imdbapi.yaml"), "utf8");
  const tmdbServerUrl = tmdbBlueprint
    .data
    ?.api
    ?.schema
    ?.servers
    ?.[0]
    ?.url;
  const imdbHost = imdbYaml.match(/^host:\s*(\S+)/m)?.[1];

  return {
    tmdbServerUrl: tmdbServerUrl || "https://api.themoviedb.org",
    imdbApiBaseUrl: `https://${imdbHost || "api.imdbapi.dev"}`
  };
}

const API_BLUEPRINTS = loadApiBlueprints();
const TMDB_API_URL = (process.env.TMDB_API_URL || `${API_BLUEPRINTS.tmdbServerUrl}/3/`).replace(/\/+$/, "");
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function imageUrl(size, filePath) {
  return filePath ? `${TMDB_IMAGE_BASE}/${size}${filePath}` : undefined;
}

function getYear(releaseDate) {
  const match = String(releaseDate || "").match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

function applyManualMatch(parsed, manualMatches) {
  const override = manualMatches[parsed.filename];
  if (!override) return parsed;
  return { ...parsed, ...override };
}

function chooseTmdbResult(parsed, results) {
  if (!Array.isArray(results) || results.length === 0) return null;
  if (parsed.year) {
    return results.find(result => getYear(result.release_date) === parsed.year) || null;
  }
  return results.length === 1 ? results[0] : null;
}

async function tmdbRequest(pathname, params = {}) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new Error("TMDB_API_KEY is missing from .env");

  const url = new URL(`${TMDB_API_URL}${pathname}`);
  url.searchParams.set("api_key", apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TMDB ${response.status} for ${pathname}`);
  }
  return response.json();
}

async function findTmdbDetails(parsed) {
  if (parsed.tmdbId) {
    return tmdbRequest(`/movie/${parsed.tmdbId}`, {
      language: "nl-NL",
      append_to_response: "credits,images",
      include_image_language: "nl,en,null"
    });
  }

  const search = await tmdbRequest("/search/movie", {
    language: "nl-NL",
    query: parsed.title,
    year: parsed.year || undefined,
    include_adult: "false"
  });
  const result = chooseTmdbResult(parsed, search.results || []);
  if (!result) return null;

  return tmdbRequest(`/movie/${result.id}`, {
    language: "nl-NL",
    append_to_response: "credits,images",
    include_image_language: "nl,en,null"
  });
}

function pickLogo(images) {
  const logos = images && Array.isArray(images.logos) ? images.logos : [];
  const logo = logos.find(item => item.iso_639_1 === "nl") ||
    logos.find(item => item.iso_639_1 === "en") ||
    logos[0];
  return logo ? imageUrl("w500", logo.file_path) : undefined;
}

function buildStremioMeta({ parsed, details }) {
  const year = getYear(details.release_date) || parsed.year;
  const id = buildMovieId(details.title || parsed.title, year);
  const directorNames = (details.credits?.crew || [])
    .filter(person => person.job === "Director")
    .map(person => person.name);

  const meta = {
    id,
    type: "movie",
    name: details.title || parsed.title,
    originalName: details.original_title || details.title || parsed.title,
    videoFilename: parsed.filename,
    releaseInfo: year ? String(year) : undefined,
    released: details.release_date ? new Date(details.release_date).toISOString() : undefined,
    runtime: details.runtime ? `${details.runtime} min` : undefined,
    poster: imageUrl("w500", details.poster_path),
    logo: pickLogo(details.images),
    background: imageUrl("original", details.backdrop_path),
    description: details.overview || undefined,
    genres: (details.genres || []).map(genre => genre.name),
    cast: (details.credits?.cast || []).slice(0, 8).map(person => person.name),
    director: directorNames,
    tmdbId: details.id,
    imdbId: details.imdb_id || undefined,
    behaviorHints: {
      defaultVideoId: id
    }
  };

  return Object.fromEntries(Object.entries(meta).filter(([, value]) => value !== undefined));
}

function buildCatalogMeta(meta) {
  const allowed = ["id", "type", "name", "poster", "background", "description", "releaseInfo"];
  return Object.fromEntries(allowed.filter(key => meta[key] !== undefined).map(key => [key, meta[key]]));
}

function scanVideoFiles(nlDir = NL_DIR) {
  if (!fs.existsSync(nlDir)) {
    throw new Error(`Missing local video directory: ${nlDir}`);
  }
  return fs.readdirSync(nlDir)
    .filter(isSupportedVideoFile)
    .sort((a, b) => a.localeCompare(b));
}

async function generate() {
  const manualMatches = readJson(path.join(DATA_DIR, "manual-matches.json"), {});
  const filenames = scanVideoFiles();
  const failures = [];
  const metas = [];
  const seenIds = new Map();

  for (const filename of filenames) {
    const parsed = applyManualMatch(parseVideoFilename(filename), manualMatches);
    try {
      const details = await findTmdbDetails(parsed);
      if (!details) {
        failures.push({ filename, reason: "no confident TMDB match", parsed });
        continue;
      }

      const meta = buildStremioMeta({ parsed, details });
      if (seenIds.has(meta.id)) {
        failures.push({ filename, reason: "duplicate generated id", id: meta.id, conflictsWith: seenIds.get(meta.id) });
        continue;
      }
      seenIds.set(meta.id, filename);
      metas.push(meta);
    } catch (error) {
      failures.push({ filename, reason: error.message, parsed });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    sourceCount: filenames.length,
    successCount: metas.length,
    failureCount: failures.length,
    failures
  };

  writeJson(path.join(DATA_DIR, "generation-report.json"), report);

  if (failures.length > 0) {
    console.error(`Metadata generation failed for ${failures.length} file(s). See data/generation-report.json.`);
    process.exitCode = 1;
    return report;
  }

  fs.rmSync(META_DIR, { recursive: true, force: true });
  fs.mkdirSync(META_DIR, { recursive: true });

  const catalog = { metas: metas.map(buildCatalogMeta) };
  writeJson(path.join(DATA_DIR, "catalog.json"), catalog);

  for (const meta of metas) {
    writeJson(path.join(META_DIR, `${idToSlug(meta.id)}.json`), meta);
  }

  console.log(`Generated metadata for ${metas.length} movie(s).`);
  return report;
}

if (require.main === module) {
  generate().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  applyManualMatch,
  chooseTmdbResult,
  buildStremioMeta,
  buildCatalogMeta,
  loadApiBlueprints,
  scanVideoFiles,
  generate
};

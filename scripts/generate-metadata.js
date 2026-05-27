#!/usr/bin/env node

require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const {
  DATA_DIR,
  META_DIR,
  POSTER_DIR,
  ROOT_DIR,
  VIDEO_DIR,
  resolveVideoDir
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
const DEFAULT_BASE_URL = process.env.BASE_URL || "http://127.0.0.1:7010";

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

function normalizeApiUrl(value, fallback) {
  return String(value || fallback).replace(/\/+$/, "");
}

function getYear(releaseDate) {
  const match = String(releaseDate || "").match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

function comparableTitle(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function titlesMatch(parsedTitle, result) {
  const wanted = comparableTitle(parsedTitle);
  return [result.title, result.original_title].map(comparableTitle).includes(wanted);
}

function applyManualMatch(parsed, manualMatches) {
  const override = manualMatches[parsed.filename];
  if (!override) return parsed;
  return { ...parsed, ...override };
}

function chooseTmdbResult(parsed, results) {
  if (!Array.isArray(results) || results.length === 0) return null;
  const exactMatches = results.filter(result => titlesMatch(parsed.title, result));
  if (parsed.year) {
    const exactYear = results.find(result => getYear(result.release_date) === parsed.year);
    if (exactYear) return exactYear;
    const nearYear = exactMatches.find(result => {
      const year = getYear(result.release_date);
      return year !== null && Math.abs(year - parsed.year) <= 1;
    });
    if (nearYear) return nearYear;
    return exactMatches.length === 1 ? exactMatches[0] : null;
  }
  if (exactMatches.length === 1) return exactMatches[0];
  if (exactMatches.length > 1) {
    const ranked = exactMatches
      .slice()
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    const top = ranked[0].popularity || 0;
    const second = ranked[1].popularity || 0;
    if (top >= 1 && top >= second * 2) return ranked[0];
  }
  return results.length === 1 ? results[0] : null;
}

function uniqueValues(values) {
  const seen = new Set();
  const unique = [];
  values.forEach(value => {
    if (value && !seen.has(value)) {
      seen.add(value);
      unique.push(value);
    }
  });
  return unique;
}

function formatRuntime(minutes) {
  if (!minutes) return undefined;
  const runtime = Number(minutes);
  if (!Number.isFinite(runtime) || runtime <= 0) return undefined;
  const hours = Math.floor(runtime / 60);
  const remaining = runtime % 60;
  return hours > 0 ? `${hours}h${String(remaining).padStart(2, "0")}min` : `${remaining}min`;
}

function buildStremioId(details, parsed) {
  if (details.imdb_id) return details.imdb_id;
  if (details.id) return `tmdb:${details.id}`;
  return buildMovieId(details.title || parsed.title, parsed.year);
}

function buildPosterUrl(apiUrl, apiKey, imdbId, lang = "nl-NL") {
  const base = normalizeApiUrl(apiUrl, "https://api.top-posters.com");
  const url = `${base}/${encodeURIComponent(apiKey)}/imdb/poster/${encodeURIComponent(imdbId)}.jpg`;
  if (!lang) return url;
  const params = new URLSearchParams({ lang });
  return `${url}?${params.toString()}`;
}

function buildPosterRequestHeaders() {
  return {
    Accept: "image/jpeg,image/*,*/*",
    "User-Agent": "Mozilla/5.0 (compatible; TekenfilmsMetadataGenerator/0.1; +https://tekenfilms.nexioapp.org)"
  };
}

function buildRatingsUrl(apiUrl) {
  const base = normalizeApiUrl(apiUrl, "https://api.nexioapp.org/v1");
  return `${base.replace(/\/v1$/, "")}/v1/ratings/bulk`;
}

function localPosterUrl(baseUrl, identifier) {
  return `${String(baseUrl || DEFAULT_BASE_URL).trim().replace(/\/+$/, "")}/posters/${idToSlug(identifier)}.jpg`;
}

function stremioSearchUrl(value) {
  const params = new URLSearchParams({ search: value });
  return `stremio:///search?${params.toString()}`;
}

function buildLinks(meta) {
  const links = [];
  if (meta.imdbId) {
    links.push({
      name: meta.imdbRating || "IMDb",
      category: "imdb",
      url: `https://imdb.com/title/${meta.imdbId}`
    });
  }
  links.push({
    name: meta.name,
    category: "share",
    url: `https://www.strem.io/s/movie/${idToSlug(buildMovieId(meta.name))}`
  });
  for (const genre of meta.genres || []) {
    links.push({ name: genre, category: "Genres", url: stremioSearchUrl(genre) });
  }
  for (const person of (meta.cast || []).slice(0, 8)) {
    links.push({ name: person, category: "Cast", url: stremioSearchUrl(person) });
  }
  for (const person of (meta.director || []).slice(0, 3)) {
    links.push({ name: person, category: "Director", url: stremioSearchUrl(person) });
  }
  return links;
}

function mergeRating(meta, rating) {
  if (!rating) return meta;
  if (rating.averageRating !== undefined && rating.averageRating !== null) {
    meta.imdbRating = Number(rating.averageRating).toFixed(1);
  }
  if (rating.numVotes !== undefined && rating.numVotes !== null) {
    meta.imdbRatingCount = rating.numVotes;
  }
  return meta;
}

function buildQueryCandidates(title) {
  const aliases = {
    "De Reddertjes in Kangeroeland": ["De Reddertjes in Kangoeroeland", "The Rescuers Down Under"],
    "Meet the Robonsons": ["Meet the Robinsons"],
    "Tijgetjes Film": ["Tigger Movie", "The Tigger Movie"],
    "Suske en Wiske De Duistere Diamant": ["Suske Wiske Duistere Diamant", "De duistere diamant"]
  };
  const candidates = [title];
  if (title.includes(" en ")) candidates.push(title.replace(" en ", " & "));
  candidates.push(...(aliases[title] || []));
  return uniqueValues(candidates);
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

  let result = null;
  for (const query of buildQueryCandidates(parsed.title)) {
    const queryParsed = { ...parsed, title: query };
    for (const includeYear of [true, false]) {
      const search = await tmdbRequest("/search/movie", {
        language: "nl-NL",
        query,
        year: includeYear ? parsed.year || undefined : undefined,
        include_adult: "false"
      });
      result = chooseTmdbResult(queryParsed, search.results || []);
      if (result) break;
    }
    if (result) break;
  }
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

function buildStremioMeta({ parsed, details, baseUrl = DEFAULT_BASE_URL }) {
  const year = getYear(details.release_date) || parsed.year;
  const id = buildStremioId(details, { ...parsed, year });
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
    runtime: formatRuntime(details.runtime),
    poster: localPosterUrl(baseUrl, id),
    logo: pickLogo(details.images),
    background: imageUrl("original", details.backdrop_path),
    description: details.overview || undefined,
    genres: (details.genres || []).map(genre => genre.name),
    cast: (details.credits?.cast || []).slice(0, 8).map(person => person.name),
    director: directorNames,
    tmdbId: details.id,
    imdbId: details.imdb_id || undefined,
    behaviorHints: {
      defaultVideoId: id,
      hasScheduledVideos: false
    }
  };

  return Object.fromEntries(Object.entries(meta).filter(([, value]) => value !== undefined));
}

function buildCatalogMeta(meta) {
  const allowed = ["id", "type", "name", "poster", "logo", "background", "description", "releaseInfo", "runtime", "imdbRating", "links"];
  return Object.fromEntries(allowed.filter(key => meta[key] !== undefined).map(key => [key, meta[key]]));
}

async function fetchBulkRatings(identifiers) {
  const ids = identifiers.filter(Boolean);
  const apiKey = process.env.IMDBRATINGS_API_KEY;
  if (ids.length === 0 || !apiKey) return new Map();

  const response = await fetch(buildRatingsUrl(process.env.IMDBRATINGS_API_URL), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-API-Key": apiKey
    },
    body: JSON.stringify({ identifiers: ids })
  });
  if (!response.ok) throw new Error(`IMDb ratings ${response.status} for /v1/ratings/bulk`);
  const body = await response.json();
  return new Map((body.results || []).map(item => [item.tconst, item]));
}

async function downloadPoster(imdbId, destination) {
  const apiKey = process.env.TOPPOSTER_API_KEY;
  const apiUrl = normalizeApiUrl(process.env.TOPPOSTER_API_URL, "https://api.top-posters.com");
  if (!apiKey || !imdbId) return false;

  for (const lang of ["nl-NL", null]) {
    const response = await fetch(buildPosterUrl(apiUrl, apiKey, imdbId, lang), {
      headers: buildPosterRequestHeaders()
    }).catch(() => null);
    if (!response || !response.ok) continue;
    const bytes = Buffer.from(await response.arrayBuffer());
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes);
    return true;
  }
  return false;
}

function resolveVideoLayout(layout) {
  return String(layout || process.env.VIDEO_LAYOUT || process.env.NL_LAYOUT || "flat").toLowerCase();
}

function toPosixRelative(baseDir, filePath) {
  return path.relative(baseDir, filePath).split(path.sep).join("/");
}

function scanVideoFiles(nlDir = VIDEO_DIR, layout) {
  if (!fs.existsSync(nlDir)) {
    throw new Error(`Missing local video directory: ${nlDir}`);
  }
  const mode = resolveVideoLayout(layout);
  const entries = [];

  if (mode === "flat" || mode === "auto") {
    for (const name of fs.readdirSync(nlDir)) {
      const filePath = path.join(nlDir, name);
      if (fs.statSync(filePath).isFile() && isSupportedVideoFile(name)) {
        entries.push(name);
      }
    }
  }

  if (mode === "subfolders" || mode === "auto") {
    for (const name of fs.readdirSync(nlDir)) {
      const dirPath = path.join(nlDir, name);
      if (!fs.statSync(dirPath).isDirectory()) continue;
      for (const childName of fs.readdirSync(dirPath)) {
        const filePath = path.join(dirPath, childName);
        if (fs.statSync(filePath).isFile() && isSupportedVideoFile(childName)) {
          entries.push(toPosixRelative(nlDir, filePath));
        }
      }
    }
  }

  if (!["flat", "subfolders", "auto"].includes(mode)) {
    throw new Error(`Unsupported VIDEO_LAYOUT: ${mode}`);
  }

  return entries
    .sort((a, b) => a.localeCompare(b));
}

function addMetaOrDuplicate(meta, seenIds, metas, duplicates) {
  if (seenIds.has(meta.id)) {
    duplicates.push({
      filename: meta.videoFilename,
      reason: "duplicate generated id",
      id: meta.id,
      conflictsWith: seenIds.get(meta.id)
    });
    return false;
  }
  seenIds.set(meta.id, meta.videoFilename);
  metas.push(meta);
  return true;
}

async function generate() {
  const manualMatches = readJson(path.join(DATA_DIR, "manual-matches.json"), {});
  const filenames = scanVideoFiles(resolveVideoDir(process.env.VIDEO_DIR), process.env.VIDEO_LAYOUT || process.env.NL_LAYOUT);
  const baseUrl = DEFAULT_BASE_URL;
  const failures = [];
  const duplicates = [];
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

      const meta = buildStremioMeta({ parsed, details, baseUrl });
      addMetaOrDuplicate(meta, seenIds, metas, duplicates);
    } catch (error) {
      failures.push({ filename, reason: error.message, parsed });
    }
  }

  if (metas.length > 0) {
    try {
      const ratings = await fetchBulkRatings(metas.map(meta => meta.imdbId));
      for (const meta of metas) {
        mergeRating(meta, ratings.get(meta.imdbId));
        meta.links = buildLinks(meta);
      }
    } catch (error) {
      failures.push({ filename: "IMDb ratings", reason: error.message });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    sourceCount: filenames.length,
    successCount: metas.length,
    failureCount: failures.length,
    duplicateCount: duplicates.length,
    duplicates,
    failures
  };

  writeJson(path.join(DATA_DIR, "generation-report.json"), report);

  if (failures.length > 0) {
    console.error(`Metadata generation failed for ${failures.length} file(s). See data/generation-report.json.`);
    process.exitCode = 1;
    return report;
  }

  const posterTempDir = path.join(DATA_DIR, "posters.tmp");
  fs.rmSync(posterTempDir, { recursive: true, force: true });
  fs.mkdirSync(posterTempDir, { recursive: true });

  for (const meta of metas) {
    if (!meta.imdbId) continue;
    const downloaded = await downloadPoster(meta.imdbId, path.join(posterTempDir, `${idToSlug(meta.id)}.jpg`));
    if (!downloaded) {
      failures.push({ filename: meta.videoFilename, reason: "no top-posters poster available", id: meta.id });
    }
  }

  if (failures.length > 0) {
    const failedReport = { ...report, failureCount: failures.length, failures };
    writeJson(path.join(DATA_DIR, "generation-report.json"), failedReport);
    fs.rmSync(posterTempDir, { recursive: true, force: true });
    console.error(`Metadata generation failed for ${failures.length} file(s). See data/generation-report.json.`);
    process.exitCode = 1;
    return failedReport;
  }

  fs.rmSync(META_DIR, { recursive: true, force: true });
  fs.rmSync(POSTER_DIR, { recursive: true, force: true });
  fs.mkdirSync(META_DIR, { recursive: true });
  fs.renameSync(posterTempDir, POSTER_DIR);

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
  addMetaOrDuplicate,
  buildQueryCandidates,
  chooseTmdbResult,
  buildStremioMeta,
  buildCatalogMeta,
  buildPosterRequestHeaders,
  buildPosterUrl,
  buildRatingsUrl,
  formatRuntime,
  loadApiBlueprints,
  mergeRating,
  resolveVideoDir,
  scanVideoFiles,
  generate
};

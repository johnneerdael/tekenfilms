# Tekenfilms Addon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a no-configuration Stremio addon in `tekenfilms/` that serves one Dutch-audio cartoon movie rail from local files in `tekenfilms/NL`.

**Architecture:** The runtime is a small Node.js Express app using `stremio-addon-sdk`. Metadata is generated ahead of time from local files plus TMDB/IMDb lookups, then stored as local JSON so Stremio requests never depend on external metadata APIs.

**Tech Stack:** Node.js 20+, Express, `stremio-addon-sdk`, `dotenv`, built-in `node:test`, built-in `fetch`.

---

## File Structure

- Create `tekenfilms/package.json`: package metadata, scripts, dependencies, and Node version.
- Create `tekenfilms/addon.js`: manifest plus catalog, meta, and stream handlers.
- Create `tekenfilms/server.js`: Express server, CORS, static file serving for `NL`, health route, manifest route, and Stremio router.
- Create `tekenfilms/lib/constants.js`: shared addon constants, supported extensions, base URL helper, and id prefix.
- Create `tekenfilms/lib/metadata-store.js`: read generated catalog/meta JSON and build stream entries.
- Create `tekenfilms/lib/filename-parser.js`: parse source video filenames into title/year candidates.
- Create `tekenfilms/lib/id.js`: slug and stable Stremio id helpers.
- Create `tekenfilms/scripts/generate-metadata.js`: scan `NL`, apply manual matches, fetch TMDB/IMDb metadata, write generated JSON and reports.
- Create `tekenfilms/data/manual-matches.json`: manual correction file.
- Create `tekenfilms/data/catalog.json`: generated catalog seed, initially empty.
- Create `tekenfilms/data/meta/.gitkeep`: keep generated metadata directory present.
- Create `tekenfilms/tests/*.test.js`: focused tests for parsing, ids, metadata store, manifest, and handlers.

Because `tekenfilms/` is not currently inside a git repository, commit steps are represented as verification checkpoints instead of `git commit` commands.

---

### Task 1: Package And Shared Constants

**Files:**
- Create: `tekenfilms/package.json`
- Create: `tekenfilms/lib/constants.js`
- Create: `tekenfilms/tests/constants.test.js`

- [ ] **Step 1: Write the failing constants test**

Create `tekenfilms/tests/constants.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ADDON_ID,
  CATALOG_ID,
  ID_PREFIX,
  SUPPORTED_VIDEO_EXTENSIONS,
  normalizeBaseUrl
} = require("../lib/constants");

test("exports stable addon constants", () => {
  assert.equal(ADDON_ID, "org.nexio.tekenfilms");
  assert.equal(CATALOG_ID, "tekenfilms_nl");
  assert.equal(ID_PREFIX, "tekenfilms:");
  assert.deepEqual(SUPPORTED_VIDEO_EXTENSIONS, [".avi", ".mkv", ".mp4", ".m4v"]);
});

test("normalizes base urls without trailing slashes", () => {
  assert.equal(normalizeBaseUrl("https://tekenfilms.nexioapp.org/"), "https://tekenfilms.nexioapp.org");
  assert.equal(normalizeBaseUrl("http://127.0.0.1:7010///"), "http://127.0.0.1:7010");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test
```

Expected: failure because `package.json` and `lib/constants.js` do not exist yet.

- [ ] **Step 3: Create package and constants**

Create `tekenfilms/package.json`:

```json
{
  "name": "tekenfilms",
  "version": "0.1.0",
  "description": "No-configuration Stremio addon for Dutch-audio cartoon movies from local files.",
  "main": "server.js",
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "start": "node server.js",
    "generate": "node scripts/generate-metadata.js",
    "test": "node --test tests/*.test.js"
  },
  "dependencies": {
    "dotenv": "^16.4.7",
    "express": "^4.18.3",
    "stremio-addon-sdk": "latest"
  }
}
```

Create `tekenfilms/lib/constants.js`:

```js
const path = require("node:path");

const ADDON_ID = "org.nexio.tekenfilms";
const ADDON_NAME = "Tekenfilms";
const CATALOG_ID = "tekenfilms_nl";
const CATALOG_NAME = "Tekenfilms (Nederlands)";
const ID_PREFIX = "tekenfilms:";
const SUPPORTED_VIDEO_EXTENSIONS = [".avi", ".mkv", ".mp4", ".m4v"];
const DEFAULT_PORT = 7010;

const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const META_DIR = path.join(DATA_DIR, "meta");
const NL_DIR = path.join(ROOT_DIR, "NL");

function normalizeBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

function getBaseUrl() {
  const port = process.env.PORT || DEFAULT_PORT;
  return normalizeBaseUrl(process.env.BASE_URL || `http://127.0.0.1:${port}`);
}

module.exports = {
  ADDON_ID,
  ADDON_NAME,
  CATALOG_ID,
  CATALOG_NAME,
  ID_PREFIX,
  SUPPORTED_VIDEO_EXTENSIONS,
  DEFAULT_PORT,
  ROOT_DIR,
  DATA_DIR,
  META_DIR,
  NL_DIR,
  normalizeBaseUrl,
  getBaseUrl
};
```

- [ ] **Step 4: Install dependencies**

Run:

```bash
npm install
```

Expected: `node_modules/` and `package-lock.json` are created under `tekenfilms/`.

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
npm test
```

Expected: `constants.test.js` passes.

- [ ] **Step 6: Checkpoint**

Run:

```bash
git -C tekenfilms status --short
```

Expected: if `tekenfilms` is still not a git repo, Git prints `fatal: not a git repository`; continue without committing.

---

### Task 2: Filename Parsing And Stable IDs

**Files:**
- Create: `tekenfilms/lib/filename-parser.js`
- Create: `tekenfilms/lib/id.js`
- Create: `tekenfilms/tests/filename-parser.test.js`
- Create: `tekenfilms/tests/id.test.js`

- [ ] **Step 1: Write failing filename parser tests**

Create `tekenfilms/tests/filename-parser.test.js`:

```js
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
```

- [ ] **Step 2: Write failing id tests**

Create `tekenfilms/tests/id.test.js`:

```js
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

test("rejects ids without the addon prefix", () => {
  assert.equal(idToSlug("tt2294629"), null);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npm test
```

Expected: failures because parser and id helpers do not exist.

- [ ] **Step 4: Implement parser and id helpers**

Create `tekenfilms/lib/filename-parser.js`:

```js
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
```

Create `tekenfilms/lib/id.js`:

```js
const { ID_PREFIX } = require("./constants");

function slugify(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildMovieId(title, year) {
  const yearSuffix = year ? `-${year}` : "";
  return `${ID_PREFIX}${slugify(title)}${yearSuffix}`;
}

function idToSlug(id) {
  if (!String(id || "").startsWith(ID_PREFIX)) return null;
  const slug = id.slice(ID_PREFIX.length);
  return slug || null;
}

module.exports = {
  slugify,
  buildMovieId,
  idToSlug
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run:

```bash
npm test
```

Expected: constants, parser, and id tests pass.

- [ ] **Step 6: Checkpoint**

Run:

```bash
git -C tekenfilms status --short
```

Expected: if `tekenfilms` is still not a git repo, Git prints `fatal: not a git repository`; continue without committing.

---

### Task 3: Metadata Store And Stream URL Building

**Files:**
- Create: `tekenfilms/lib/metadata-store.js`
- Create: `tekenfilms/data/catalog.json`
- Create: `tekenfilms/data/manual-matches.json`
- Create: `tekenfilms/data/meta/.gitkeep`
- Create: `tekenfilms/tests/metadata-store.test.js`

- [ ] **Step 1: Write failing metadata store tests**

Create `tekenfilms/tests/metadata-store.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test
```

Expected: failure because `metadata-store.js` and seed data do not exist.

- [ ] **Step 3: Create seed data**

Create `tekenfilms/data/catalog.json`:

```json
{
  "metas": []
}
```

Create `tekenfilms/data/manual-matches.json`:

```json
{}
```

Create `tekenfilms/data/meta/.gitkeep` as an empty file.

- [ ] **Step 4: Implement metadata store**

Create `tekenfilms/lib/metadata-store.js`:

```js
const fs = require("node:fs");
const path = require("node:path");
const { DATA_DIR, ADDON_NAME } = require("./constants");

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(`[metadata-store] failed reading ${filePath}: ${error.message}`);
    }
    return fallback;
  }
}

function loadCatalog(dataDir = DATA_DIR) {
  const catalog = readJson(path.join(dataDir, "catalog.json"), { metas: [] });
  if (!Array.isArray(catalog.metas)) return { metas: [] };
  return catalog;
}

function loadMeta(slug, dataDir = DATA_DIR) {
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return null;
  return readJson(path.join(dataDir, "meta", `${slug}.json`), null);
}

function encodePathSegment(filename) {
  return encodeURIComponent(filename).replace(/%2F/gi, "");
}

function buildStreamForMeta(meta, baseUrl) {
  if (!meta || !meta.videoFilename) return null;
  return {
    title: "NL Gesproken",
    name: ADDON_NAME,
    url: `${baseUrl}/nl-gesproken/${encodePathSegment(meta.videoFilename)}`
  };
}

module.exports = {
  loadCatalog,
  loadMeta,
  buildStreamForMeta
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run:

```bash
npm test
```

Expected: metadata store tests pass with the earlier tests.

- [ ] **Step 6: Checkpoint**

Run:

```bash
git -C tekenfilms status --short
```

Expected: if `tekenfilms` is still not a git repo, Git prints `fatal: not a git repository`; continue without committing.

---

### Task 4: Stremio Addon Manifest And Handlers

**Files:**
- Create: `tekenfilms/addon.js`
- Create: `tekenfilms/tests/addon.test.js`

- [ ] **Step 1: Write failing addon tests**

Create `tekenfilms/tests/addon.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test
```

Expected: failure because `addon.js` does not exist.

- [ ] **Step 3: Implement addon manifest and handlers**

Create `tekenfilms/addon.js`:

```js
const { addonBuilder } = require("stremio-addon-sdk");
const {
  ADDON_ID,
  ADDON_NAME,
  CATALOG_ID,
  CATALOG_NAME,
  ID_PREFIX,
  getBaseUrl
} = require("./lib/constants");
const {
  loadCatalog,
  loadMeta,
  buildStreamForMeta
} = require("./lib/metadata-store");
const { idToSlug } = require("./lib/id");

const manifest = {
  id: ADDON_ID,
  version: "0.1.0",
  name: ADDON_NAME,
  description: "Nederlandstalige tekenfilms uit een lokale collectie.",
  types: ["movie"],
  resources: [
    "catalog",
    {
      name: "meta",
      types: ["movie"],
      idPrefixes: [ID_PREFIX]
    },
    {
      name: "stream",
      types: ["movie"],
      idPrefixes: [ID_PREFIX]
    }
  ],
  catalogs: [
    {
      id: CATALOG_ID,
      type: "movie",
      name: CATALOG_NAME
    }
  ],
  behaviorHints: {
    configurable: false,
    configurationRequired: false
  }
};

function createHandlers(deps = {}) {
  const store = {
    getBaseUrl: deps.getBaseUrl || getBaseUrl,
    loadCatalog: deps.loadCatalog || loadCatalog,
    loadMeta: deps.loadMeta || loadMeta
  };

  return {
    async catalog({ type, id }) {
      if (type !== "movie" || id !== CATALOG_ID) return { metas: [] };
      return {
        metas: store.loadCatalog().metas,
        cacheMaxAge: 86400
      };
    },

    async meta({ type, id }) {
      if (type !== "movie") return { meta: null };
      const slug = idToSlug(id);
      if (!slug) return { meta: null };
      const meta = store.loadMeta(slug);
      if (!meta) return { meta: null };
      return { meta, cacheMaxAge: 86400 };
    },

    async stream({ type, id }) {
      if (type !== "movie") return { streams: [] };
      const slug = idToSlug(id);
      if (!slug) return { streams: [] };
      const meta = store.loadMeta(slug);
      const stream = buildStreamForMeta(meta, store.getBaseUrl());
      if (!stream) return { streams: [] };
      return { streams: [stream], cacheMaxAge: 86400 };
    }
  };
}

const builder = new addonBuilder(manifest);
const handlers = createHandlers();

builder.defineCatalogHandler(handlers.catalog);
builder.defineMetaHandler(handlers.meta);
builder.defineStreamHandler(handlers.stream);

module.exports = {
  manifest,
  createHandlers,
  addonInterface: builder.getInterface()
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm test
```

Expected: addon tests pass with all previous tests.

- [ ] **Step 5: Checkpoint**

Run:

```bash
git -C tekenfilms status --short
```

Expected: if `tekenfilms` is still not a git repo, Git prints `fatal: not a git repository`; continue without committing.

---

### Task 5: Metadata Generator

**Files:**
- Create: `tekenfilms/scripts/generate-metadata.js`
- Create: `tekenfilms/tests/generate-metadata.test.js`

- [ ] **Step 1: Write failing generator unit tests**

Create `tekenfilms/tests/generate-metadata.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  applyManualMatch,
  chooseTmdbResult,
  buildStremioMeta,
  buildCatalogMeta
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test
```

Expected: failure because the generator script does not exist.

- [ ] **Step 3: Implement generator helpers and CLI**

Create `tekenfilms/scripts/generate-metadata.js`:

```js
#!/usr/bin/env node

require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const {
  DATA_DIR,
  META_DIR,
  NL_DIR,
  SUPPORTED_VIDEO_EXTENSIONS
} = require("../lib/constants");
const { parseVideoFilename, isSupportedVideoFile } = require("../lib/filename-parser");
const { buildMovieId, idToSlug } = require("../lib/id");

const TMDB_API_URL = (process.env.TMDB_API_URL || "https://api.themoviedb.org/3/").replace(/\/+$/, "");
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
  scanVideoFiles,
  generate
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm test
```

Expected: generator helper tests pass with all previous tests.

- [ ] **Step 5: Run generator without `NL` to verify clear failure**

Run:

```bash
npm run generate
```

Expected while `tekenfilms/NL` is absent: command exits nonzero and prints a missing local video directory error.

- [ ] **Step 6: Checkpoint**

Run:

```bash
git -C tekenfilms status --short
```

Expected: if `tekenfilms` is still not a git repo, Git prints `fatal: not a git repository`; continue without committing.

---

### Task 6: Express Server

**Files:**
- Create: `tekenfilms/server.js`
- Create: `tekenfilms/tests/server.test.js`

- [ ] **Step 1: Write failing server tests**

Create `tekenfilms/tests/server.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");

const { createApp } = require("../server");

function listen(app) {
  return new Promise(resolve => {
    const server = app.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

test("serves health and manifest endpoints", async () => {
  const { server, url } = await listen(createApp());
  try {
    const health = await fetch(`${url}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "alive" });

    const manifest = await fetch(`${url}/manifest.json`);
    assert.equal(manifest.status, 200);
    const body = await manifest.json();
    assert.equal(body.id, "org.nexio.tekenfilms");
    assert.equal(body.behaviorHints.configurable, false);
  } finally {
    server.close();
  }
});

test("sets CORS headers", async () => {
  const { server, url } = await listen(createApp());
  try {
    const response = await fetch(`${url}/manifest.json`);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
  } finally {
    server.close();
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test
```

Expected: failure because `server.js` does not exist.

- [ ] **Step 3: Implement Express server**

Create `tekenfilms/server.js`:

```js
require("dotenv").config();

const express = require("express");
const { getRouter } = require("stremio-addon-sdk");
const { addonInterface, manifest } = require("./addon");
const { DEFAULT_PORT, NL_DIR } = require("./lib/constants");

function createApp() {
  const app = express();

  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD");
    res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, Range");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range");
    if (req.method === "OPTIONS") return res.status(204).end();
    next();
  });

  app.get("/health", (req, res) => {
    res.status(200).json({ status: "alive" });
  });

  app.get("/manifest.json", (req, res) => {
    res.json(manifest);
  });

  app.use("/nl-gesproken", express.static(NL_DIR, {
    fallthrough: true,
    index: false,
    setHeaders(res) {
      res.setHeader("Cache-Control", "public, max-age=86400");
    }
  }));

  app.use("/", getRouter(addonInterface));

  return app;
}

if (require.main === module) {
  const port = process.env.PORT || DEFAULT_PORT;
  createApp().listen(port, "0.0.0.0", () => {
    console.log(`TEKENFILMS ONLINE | PORT ${port}`);
  });
}

module.exports = {
  createApp
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm test
```

Expected: server tests pass with all previous tests.

- [ ] **Step 5: Start local server**

Run:

```bash
npm start
```

Expected: server logs `TEKENFILMS ONLINE | PORT 7010`. Stop it after confirming startup.

- [ ] **Step 6: Checkpoint**

Run:

```bash
git -C tekenfilms status --short
```

Expected: if `tekenfilms` is still not a git repo, Git prints `fatal: not a git repository`; continue without committing.

---

### Task 7: End-To-End Local Verification

**Files:**
- Modify: `tekenfilms/data/manual-matches.json` if generation reports ambiguous matches after real videos are added.
- Generated: `tekenfilms/data/catalog.json`
- Generated: `tekenfilms/data/meta/*.json`
- Generated: `tekenfilms/data/generation-report.json`

- [ ] **Step 1: Confirm local video directory exists**

Run:

```bash
find tekenfilms/NL -maxdepth 1 -type f
```

Expected: lists `.avi`, `.mkv`, `.mp4`, or `.m4v` files. If it prints `No such file or directory`, create `tekenfilms/NL` and add the Dutch-audio movie files before running generation.

- [ ] **Step 2: Run metadata generation**

Run:

```bash
npm run generate
```

Expected with all matches resolved: command exits successfully and prints `Generated metadata for N movie(s).`

Expected with unresolved matches: command exits nonzero and writes `tekenfilms/data/generation-report.json`. Open that report and add exact corrections to `tekenfilms/data/manual-matches.json`, for example:

```json
{
  "De Reddertjes in Kangeroeland.m4v": {
    "tmdbId": 11135,
    "title": "The Rescuers Down Under",
    "year": 1990
  }
}
```

- [ ] **Step 3: Re-run generation after corrections**

Run:

```bash
npm run generate
```

Expected: command exits successfully and `data/generation-report.json` has `"failureCount": 0`.

- [ ] **Step 4: Run full test suite**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Start server**

Run:

```bash
npm start
```

Expected: server logs `TEKENFILMS ONLINE | PORT 7010`.

- [ ] **Step 6: Verify manifest**

Run in another terminal:

```bash
curl http://127.0.0.1:7010/manifest.json
```

Expected: JSON includes `"id":"org.nexio.tekenfilms"`, one `movie` catalog named `Tekenfilms (Nederlands)`, and no `config` field.

- [ ] **Step 7: Verify catalog**

Run:

```bash
curl http://127.0.0.1:7010/catalog/movie/tekenfilms_nl.json
```

Expected: JSON includes a non-empty `metas` array when generated metadata exists.

- [ ] **Step 8: Verify one meta endpoint**

Pick an id from the catalog and run:

```bash
curl http://127.0.0.1:7010/meta/movie/tekenfilms:frozen-2013.json
```

Expected: JSON includes `meta.name`, `meta.poster`, `meta.background`, `meta.description`, and `meta.videoFilename`.

- [ ] **Step 9: Verify one stream endpoint**

Run:

```bash
curl http://127.0.0.1:7010/stream/movie/tekenfilms:frozen-2013.json
```

Expected: JSON includes one stream URL under `/nl-gesproken/`.

- [ ] **Step 10: Stop server**

Stop the foreground `npm start` process with Ctrl-C.

---

## Self-Review Notes

Spec coverage:

- No-config manifest: Task 4 and Task 6.
- Single catalog rail: Task 4 and Task 7.
- Local `NL` video serving: Task 6 and Task 7.
- Generated metadata: Task 5 and Task 7.
- Strict match failures and report: Task 5 and Task 7.
- Manual mappings: Task 3, Task 5, and Task 7.
- Runtime error handling for unknown ids: Task 4.
- Tests for parser, mappings, ids, stream URLs, manifest, and handlers: Tasks 1 through 6.

The plan avoids runtime metadata lookups and keeps generation separate from request handling.

# Tekenfilms Stremio Addon

No-configuration Stremio addon for Dutch-audio cartoon movies and series stored as local video files.

The addon exposes Stremio catalogs for:

- `Tekenfilms (Nederlands)`
- `Series (Nederlands)`

Runtime metadata is local JSON. Use the generator first to match files in `NL/` or `VIDEO_DIR` against TMDB, enrich them with IMDb ratings and imdbapi.dev episode IDs, download self-hosted posters, review the report, then write `data/catalog.json`, `data/series-catalog.json`, `data/meta/*.json`, and `data/posters/*.jpg`.

## Requirements

- Node.js 20+
- Python 3.9+
- `mediainfo`, optional but recommended for accurate stream metadata
- Docker, if running the container
- TMDB, IMDb ratings, and TOP Posters API keys in `.env`

Create `.env`:

```env
TMDB_API_KEY=your_tmdb_key
TMDB_API_URL=https://api.themoviedb.org/3/
IMDBRATINGS_API_URL=https://your-imdb-ratings-api
IMDBRATINGS_API_KEY=your_imdb_ratings_key
TOPPOSTER_API_URL=https://api.top-posters.com
TOPPOSTER_API_KEY=your_top_posters_key
BASE_URL=https://tekenfilms.nexioapp.org
VIDEO_DIR=NL
VIDEO_DIRS=/app/NL,nas=/app/NAS
VIDEO_LAYOUT=flat
MEDIAINFO_ENABLED=true
MEDIAINFO_PATH=mediainfo
PORT=7010
```

`BASE_URL` should be the public URL Stremio will use for stream and poster links.
`VIDEO_DIR` controls where the generator and server read video files from. Relative paths are resolved from the project directory; absolute paths are used directly.
`VIDEO_DIRS` can be used instead of `VIDEO_DIR` to scan and serve multiple roots. Use comma-separated entries. An entry can be a plain path or `alias=/path`.

Example:

```env
VIDEO_DIRS=/app/NL,nas=/app/NAS
```

The first plain path keeps the existing URL shape, for example `/nl-gesproken/Frozen.mkv`. Aliased roots are namespaced in stream URLs, for example `/nl-gesproken/nas/Asterix.mkv`. This avoids collisions when two roots contain similar release folders.

`VIDEO_LAYOUT` controls how files are discovered in `NL/`:

- `flat`: videos are directly in `NL/`
- `subfolders`: videos are one level down in release folders
- `auto`: include both direct videos and videos one level down

`MEDIAINFO_ENABLED` controls whether the Python generator probes video files with `mediainfo --Output=JSON`. When enabled and `mediainfo` is available, generated metadata stores accurate stream facts such as resolution, video codec, HDR/Dolby Vision tags, audio languages, audio codec, channel layout, file size, runtime, and bitrate. If `mediainfo` is missing or a probe fails, the addon falls back to filename-derived stream metadata and records probe diagnostics in `data/generation-report.json`.

Set `MEDIAINFO_PATH` only when the binary is not on `PATH`.

## Directory Layout

```text
.
├── NL/                         # local video files, not committed
├── data/
│   ├── catalog.json            # generated movie catalog index
│   ├── series-catalog.json     # generated series catalog index
│   ├── manual-matches.json     # manual TMDB match overrides
│   ├── meta/                   # generated movie and series metadata
│   └── posters/                # downloaded self-hosted TOP Posters images
├── scripts/
│   ├── generate-metadata.js    # Node generator
│   └── generate_metadata.py    # Python preview/write generator
├── addon.js                    # Stremio manifest and handlers
├── server.js                   # Express server
├── Dockerfile
└── compose.yml
```

## Install

```bash
npm install
```

## Add Video Files

Put Dutch-audio movies and series in `NL/` or the configured `VIDEO_DIR`.

Supported extensions:

- `.avi`
- `.mkv`
- `.mp4`
- `.m4v`

Example:

```text
NL/Frozen.2013.BluRay.NL.avi
NL/Alice in Wonderland (1951).m4v
```

Subfolder layout is also supported:

```text
NL/Aladdin.1992.2160p.DSNP.WEB-DL.DUAL-DUTCHFAM/
└── aladdin.1992.2160p.dsnp.web-dl.dual-dutchfam.mkv
```

Set `VIDEO_LAYOUT=subfolders` for this layout, or `VIDEO_LAYOUT=auto` while migrating between layouts. If the files live outside the project, set `VIDEO_DIR`, for example:

```env
VIDEO_DIR=/home/jneerdael/Downloads
VIDEO_LAYOUT=subfolders
```

For multiple host folders in Docker, mount each host path and set `VIDEO_DIRS` to the container paths:

```yaml
environment:
  VIDEO_DIRS: "/app/NL,nas=/app/NAS"
  VIDEO_LAYOUT: "auto"
volumes:
  - /homeassistant/dutchfam:/app/NL:ro
  - /homeassistant/nas:/app/NAS:ro
  - ./data:/app/data:ro
```

## TV Series

TV episodes are supported in one-level release folders. Example:

```env
VIDEO_DIR=/home/jneerdael/Downloads
VIDEO_LAYOUT=subfolders
```

```text
Asterix.and.Obelix.The.Big.Fight.S01.2025.1080p.WEB-DL.DDP5.1.H265-DUTCHFAM/
├── Asterix.and.Obelix.The.Big.Fight.S01E01.2025.1080p.WEB-DL.DDP5.1.H265-DUTCHFAM.mkv
├── Asterix.and.Obelix.The.Big.Fight.S01E02.2025.1080p.WEB-DL.DDP5.1.H265-DUTCHFAM.mkv
└── Asterix.and.Obelix.The.Big.Fight.S01E03.2025.1080p.WEB-DL.DDP5.1.H265-DUTCHFAM.mkv
```

Series IDs use the parent IMDb ID. Episode video IDs use Stremio's IMDb series format:

```text
{seriesImdbId}:{season}:{episode}
```

For example:

```text
tt32145678:1:1
```

Episode IMDb IDs from imdbapi.dev are stored in generated episode metadata as `episodeImdbId` when available, but Stremio stream requests use the parent-series video ID format above.

## Preview Metadata Matches

Run the Python preview generator before starting the addon:

```bash
npm run generate:preview
```

This scans `VIDEO_DIR` (default `NL/`), queries TMDB, enriches matches with IMDb ratings when available, and writes:

```text
data/generation-report.json
```

Preview mode does not write `data/catalog.json` or `data/meta/*.json`.

The report includes:

- `sourceCount`
- `successCount`
- `failureCount`
- `mediainfoCount`
- `mediainfoFailures`
- `successes`
- `failures`

## Fix Failed Matches

If matching fails, add exact overrides to `data/manual-matches.json`.

Example:

```json
{
  "De Reddertjes in Kangeroeland.m4v": {
    "tmdbId": 11135,
    "title": "The Rescuers Down Under",
    "year": 1990
  }
}
```

Run preview again:

```bash
npm run generate:preview
```

Continue until `failureCount` is `0`.

## Generate Addon Data

When all files match, write the catalog and metadata files:

```bash
npm run generate:python
```

This writes:

```text
data/catalog.json
data/series-catalog.json
data/meta/<movie-slug>.json
data/posters/<imdb-id>.jpg
```

Generated movie metadata includes `streamInfo` when `mediainfo` succeeds. Generated series metadata stores `streamInfo` on each episode video. Stream responses use that data first, then fall back to filename parsing for older snapshots or unprobed files.

Poster URLs in metadata always point at the addon host, for example `https://tekenfilms.nexioapp.org/posters/tt2294629.jpg`. The generator fetches TOP Posters with `lang=nl-NL` first and retries without `lang` when no Dutch poster is returned.

`npm run generate` is an alias for the Python write generator. The legacy Node generator is still available for compatibility checks:

```bash
npm run generate:node
```

## Run Locally

```bash
npm start
```

Local endpoints:

- `http://127.0.0.1:7010/manifest.json`
- `http://127.0.0.1:7010/catalog/movie/tekenfilms_nl.json`
- `http://127.0.0.1:7010/catalog/series/tekenfilms_series_nl.json`
- `http://127.0.0.1:7010/health`

Install this manifest in Stremio for local testing:

```text
http://127.0.0.1:7010/manifest.json
```

## Run With Docker Compose

Generate metadata first, then start the container:

```bash
docker compose up -d
```

`compose.yml` mounts:

- `./NL` to `/app/NL:ro`
- `./data` to `/app/data:ro`

Default image:

```text
ghcr.io/johnneerdael/tekenfilms:latest
```

## Build Docker Image Locally

```bash
docker build -t tekenfilms:test .
```

Run it:

```bash
docker run --rm \
  -p 7010:7010 \
  -e BASE_URL=http://127.0.0.1:7010 \
  -v "$PWD/NL:/app/NL:ro" \
  -v "$PWD/data:/app/data:ro" \
  tekenfilms:test
```

## GitHub Container Registry

The GitHub Actions workflow at `.github/workflows/docker.yml` builds and pushes the image to GHCR on:

- pushes to `main`
- tags matching `v*`
- manual workflow dispatch

Published image:

```text
ghcr.io/johnneerdael/tekenfilms
```

Tags include:

- `latest` for the default branch
- branch name
- git tag
- `sha-<commit>`

## Test

```bash
npm test
```

This runs:

- Node tests with `node --test`
- Python generator tests with `unittest`

## Troubleshooting

### `Missing local video directory`

Create `NL/` and add video files before running the generator, or set `VIDEO_DIR` in `.env` to the folder that contains them.

### `TMDB_API_KEY is missing from .env`

Create `.env` with a valid `TMDB_API_KEY`.

### Catalog is empty

Run metadata generation first:

```bash
npm run generate:preview
npm run generate:python
```

### Stream URLs point to localhost

Set `BASE_URL` in `.env` or Compose to the public addon URL:

```env
BASE_URL=https://tekenfilms.nexioapp.org
```

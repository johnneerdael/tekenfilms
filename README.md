# Tekenfilms Stremio Addon

No-configuration Stremio addon for Dutch-audio cartoon movies stored as local video files.

The addon exposes one Stremio movie catalog:

- `Tekenfilms (Nederlands)`

Runtime metadata is local JSON. Use the generator first to match files in `NL/` against TMDB, review the report, then write `data/catalog.json` and `data/meta/*.json`.

## Requirements

- Node.js 20+
- Python 3.9+
- Docker, if running the container
- TMDB API key in `.env`

Create `.env`:

```env
TMDB_API_KEY=your_tmdb_key
TMDB_API_URL=https://api.themoviedb.org/3/
BASE_URL=https://tekenfilms.nexioapp.org
PORT=7010
```

`BASE_URL` should be the public URL Stremio will use for stream links.

## Directory Layout

```text
.
├── NL/                         # local video files, not committed
├── data/
│   ├── catalog.json            # generated catalog index
│   ├── manual-matches.json     # manual TMDB match overrides
│   └── meta/                   # generated movie metadata
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

Put Dutch-audio movies in `NL/`.

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

## Preview Metadata Matches

Run the Python preview generator before starting the addon:

```bash
npm run generate:preview
```

This scans `NL/`, queries TMDB, and writes:

```text
data/generation-report.json
```

Preview mode does not write `data/catalog.json` or `data/meta/*.json`.

The report includes:

- `sourceCount`
- `successCount`
- `failureCount`
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
data/meta/<movie-slug>.json
```

The Node generator is also available:

```bash
npm run generate
```

## Run Locally

```bash
npm start
```

Local endpoints:

- `http://127.0.0.1:7010/manifest.json`
- `http://127.0.0.1:7010/catalog/movie/tekenfilms_nl.json`
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

Create `NL/` and add video files before running the generator.

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

# Tekenfilms Stremio Addon Design

## Goal

Create a small Stremio addon in `tekenfilms/` that exposes one curated movie catalog rail for Dutch-audio cartoons from local files in `./NL`.

The addon has no user-facing configuration. It serves a plain `manifest.json`, a single catalog named `Tekenfilms (Nederlands)`, per-movie metadata, and direct streams for the matching local video files.

## Runtime Architecture

Use a standalone Node.js addon with Express and `stremio-addon-sdk`, matching the general shape of the existing Stremio addons in this folder.

Runtime files:

- `server.js`: starts Express, CORS handling, static video serving, health route, and the Stremio router.
- `addon.js`: defines the manifest and Stremio catalog/meta/stream handlers.
- `data/catalog.json`: generated lightweight catalog metadata.
- `data/meta/*.json`: generated full metadata, one file per movie.
- `NL/`: local video source directory served at `/nl-gesproken`.

The manifest will advertise:

- `types: ["movie"]`
- `resources: ["catalog", "meta", "stream"]`
- one catalog: `{ id: "tekenfilms_nl", type: "movie", name: "Tekenfilms (Nederlands)" }`
- no `config` section
- `behaviorHints.configurable = false`
- `behaviorHints.configurationRequired = false`

The addon should use `BASE_URL` from `.env`, defaulting locally to `http://127.0.0.1:<PORT>`. The expected production host is `https://tekenfilms.nexioapp.org`.

## Stremio Endpoints

The addon handles:

- `GET /manifest.json`
- `GET /catalog/movie/tekenfilms_nl.json`
- `GET /meta/movie/<id>.json`
- `GET /stream/movie/<id>.json`
- `GET /nl-gesproken/<video-file>`
- `GET /health`

Catalog responses read from `data/catalog.json`.

Meta responses read from `data/meta/<slug>.json` after validating the id prefix.

Stream responses return one direct stream:

```json
{
  "streams": [
    {
      "title": "NL Gesproken",
      "name": "Tekenfilms",
      "url": "https://tekenfilms.nexioapp.org/nl-gesproken/<encoded video filename>"
    }
  ]
}
```

## Metadata Generation

Add a generator script run with `npm run generate`.

The generator scans `./NL` for video files with extensions such as `.avi`, `.mkv`, `.mp4`, and `.m4v`. It parses each filename into a likely title and year, then applies overrides from `data/manual-matches.json` for ambiguous or awkward filenames.

The generator uses:

- `tekenfilms/.env` for API credentials.
- `tekenfilms/tmdb.json` as the TMDB API blueprint reference.
- `tekenfilms/imdbapi.yaml` as the IMDb API blueprint reference.

TMDB is the primary metadata source. Requests should prefer Dutch metadata using `language=nl-NL`, with image URLs built from TMDB image paths. IMDb API can be used for enrichment or validation when useful, especially to preserve or verify IMDb ids.

Generated metadata must include Dutch-facing fields where available:

- stable local Stremio id, for example `tekenfilms:frozen-2013`
- video filename
- Dutch display title
- original title
- release year and release date
- poster
- logo, if discoverable
- backdrop/background
- Dutch description
- genres
- runtime
- cast/directors where available
- TMDB id
- IMDb id
- default video behavior hints

The generator writes:

- `data/catalog.json`
- `data/meta/<slug>.json`
- `data/generation-report.json`

## Matching Rules

Generation is strict.

If any source video cannot be confidently matched, generation exits nonzero and writes the failure into `data/generation-report.json`. The generator must not create placeholder catalog entries for failed matches.

`data/manual-matches.json` is the correction mechanism for hard cases. It can map a video filename to explicit TMDB or IMDb ids, or to an exact title/year query. This keeps the runtime deterministic while allowing the curated list to be fixed without changing code.

Duplicate files that represent the same film should be reported as conflicts unless explicitly handled by manual mapping.

## Error Handling

At runtime:

- Missing catalog data returns an empty catalog plus logs an error.
- Unknown meta ids return `{ "meta": null }`.
- Unknown stream ids return `{ "streams": [] }`.
- Video filenames are URL-encoded in stream URLs.
- Static video serving allows range requests through Express static file serving.

At generation time:

- Missing `NL/` fails with a clear error.
- Missing API key fails before network requests.
- API failures are captured in the report.
- Low-confidence or multiple possible matches fail until corrected manually.

## Testing

Add focused Node tests for:

- filename parsing
- manual match application
- stable id/slug generation
- stream URL encoding
- manifest shape with no configuration
- handler behavior for unknown ids

Manual verification:

- Run `npm run generate`.
- Run `npm test`.
- Start the addon locally with `npm start`.
- Open `/manifest.json`, `/catalog/movie/tekenfilms_nl.json`, one meta endpoint, and one stream endpoint.
- Install the local manifest in Stremio and confirm the `Tekenfilms (Nederlands)` rail appears with playable direct streams.

## Out Of Scope

This design does not include:

- series or episode handling
- user configuration
- runtime metadata lookups
- transcoding
- subtitle handling
- authentication or access control

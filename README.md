# Tekenfilms Stremio Addon

No-configuration Stremio addon for Dutch-audio cartoon movies from local files in `NL/`.

## Metadata Preview

Run the Python preview generator before starting the addon:

```bash
npm run generate:preview
```

This scans `NL/`, checks TMDB matches, and writes `data/generation-report.json` with successful and failed matches. It does not write `data/catalog.json` or `data/meta/*.json`.

When the report shows `failureCount: 0`, write the addon data files:

```bash
npm run generate:python
```

If a file does not match confidently, add an override to `data/manual-matches.json`:

```json
{
  "De Reddertjes in Kangeroeland.m4v": {
    "tmdbId": 11135,
    "title": "The Rescuers Down Under",
    "year": 1990
  }
}
```

## Runtime

```bash
npm start
```

Install `http://127.0.0.1:7010/manifest.json` in Stremio for local testing.

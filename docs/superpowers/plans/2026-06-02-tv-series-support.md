# Tekenfilms TV Series Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Dutch-audio TV series support to the Tekenfilms Stremio addon, including series catalogs, series metadata with episode lists, and episode stream URLs from local release-folder files.

**Architecture:** Keep movies and series in one addon, but store generated catalogs separately by type: `data/catalog.json` for movies and `data/series-catalog.json` for series. Store both movie and series meta objects under `data/meta/<imdb-or-fallback-id>.json`; series meta contains `videos[]`, and each video maps to an episode file through `videoFilename`. Use parent series IMDb IDs as Stremio series IDs, and Stremio-compatible video IDs as `{seriesImdbId}:{season}:{episode}` because official Stremio docs and Cinemeta examples use that shape for series episodes.

**Tech Stack:** Node.js Stremio Addon SDK runtime, Python metadata generator, TMDB API for Dutch metadata/artwork, imdbapi.dev for IMDb title/episode IDs, IMDb ratings API for ratings, TOP Posters API for self-hosted posters, Node test runner, Python `unittest`.

---

## Key ID Decision

Stremio series playback should use the parent series ID in the video ID. Official Stremio docs show IMDb series video IDs as:

```text
tt0898266:9:17
```

That means:

- Series catalog/meta ID: parent series IMDb ID, e.g. `tt31853240`.
- Episode video ID: `{parentSeriesImdbId}:{season}:{episode}`, e.g. `tt31853240:1:1`.
- Episode IMDb ID from imdbapi.dev: store as auxiliary metadata, e.g. `episodeImdbId: "tt..."`, and use it for ratings/traceability when available.
- Fallback if parent IMDb ID is unavailable: `tmdb:series:<tmdbId>` for meta ID and `tmdb:series:<tmdbId>:<season>:<episode>` for video IDs, but treat that as less desirable for Stremio continue-watching.

## File Map

Modify these files:

- `addon.js`: expose `series` in manifest, add series catalog handling, series meta handling, and episode stream handling.
- `lib/constants.js`: add series catalog constants and optional TV directory/layout env names if needed.
- `lib/id.js`: support `tmdb:series:<id>` slugs and video IDs containing season/episode suffixes.
- `lib/metadata-store.js`: load movie catalog, load series catalog, load meta by type/id, find a series episode by video ID, build streams for episode objects.
- `lib/filename-parser.js`: add TV episode filename parsing in Node for tests/parity.
- `scripts/generate_metadata.py`: scan TV release folders, parse episodes, query TMDB TV and imdbapi.dev, build series meta, write series catalog, and write episode mappings in `videos[]`.
- `scripts/generate-metadata.js`: add parser/scanner parity for tests and optional Node generator parity where practical.
- `README.md`: document TV folder layout, `VIDEO_LAYOUT=subfolders`, series catalog, and regeneration steps.

Add or modify tests:

- `tests/filename-parser.test.js`: TV episode parser tests.
- `tests/generate-metadata.test.js`: Node scanner/parser parity tests.
- `tests_py/test_generate_metadata_py.py`: Python parser, grouping, series meta, and writer tests.
- `tests/metadata-store.test.js`: episode stream lookup tests.
- `tests/addon.test.js`: manifest and handler tests for `series`.

---

### Task 1: Parse TV Episode Filenames

**Files:**
- Modify: `lib/filename-parser.js`
- Modify: `scripts/generate_metadata.py`
- Test: `tests/filename-parser.test.js`
- Test: `tests_py/test_generate_metadata_py.py`

- [ ] **Step 1: Write failing Node parser test**

Append this test to `tests/filename-parser.test.js`:

```js
test("parses tv episode release filenames", () => {
  assert.deepEqual(parseVideoFilename("Asterix.and.Obelix.The.Big.Fight.S01E03.2025.1080p.WEB-DL.DDP5.1.H265-DUTCHFAM.mkv"), {
    filename: "Asterix.and.Obelix.The.Big.Fight.S01E03.2025.1080p.WEB-DL.DDP5.1.H265-DUTCHFAM.mkv",
    title: "Asterix and Obelix The Big Fight",
    year: 2025,
    season: 1,
    episode: 3,
    mediaType: "series",
    extension: ".mkv"
  });
});
```

- [ ] **Step 2: Write failing Python parser test**

Add this method to `GenerateMetadataPythonTests` in `tests_py/test_generate_metadata_py.py`:

```python
def test_parses_tv_episode_release_filenames(self):
    self.assertEqual(
        parse_video_filename("Asterix.and.Obelix.The.Big.Fight.S01E03.2025.1080p.WEB-DL.DDP5.1.H265-DUTCHFAM.mkv"),
        {
            "filename": "Asterix.and.Obelix.The.Big.Fight.S01E03.2025.1080p.WEB-DL.DDP5.1.H265-DUTCHFAM.mkv",
            "title": "Asterix and Obelix The Big Fight",
            "year": 2025,
            "season": 1,
            "episode": 3,
            "mediaType": "series",
            "extension": ".mkv",
        },
    )
```

- [ ] **Step 3: Run parser tests and verify failure**

Run:

```bash
node --test tests/filename-parser.test.js
python3 -m unittest tests_py/test_generate_metadata_py.py
```

Expected: Node and Python fail because `mediaType`, `season`, and `episode` are missing.

- [ ] **Step 4: Implement Node parser support**

In `lib/filename-parser.js`, insert this check at the start of `parseVideoFilename()` after `basename` is computed:

```js
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
```

- [ ] **Step 5: Implement Python parser support**

In `scripts/generate_metadata.py`, insert this check at the start of `parse_video_filename()` after `basename` is computed:

```python
    episode_match = re.match(r"^(.*?)S(\d{1,2})E(\d{1,2})(?:[.\s]+(\d{4}))?", basename, flags=re.IGNORECASE)
    if episode_match:
        return {
            "filename": filename,
            "title": clean_title(episode_match.group(1)),
            "year": int(episode_match.group(4)) if episode_match.group(4) else None,
            "season": int(episode_match.group(2)),
            "episode": int(episode_match.group(3)),
            "mediaType": "series",
            "extension": extension,
        }
```

- [ ] **Step 6: Run tests and commit**

Run:

```bash
node --test tests/filename-parser.test.js
python3 -m unittest tests_py/test_generate_metadata_py.py
```

Expected: tests pass.

Commit:

```bash
git add lib/filename-parser.js scripts/generate_metadata.py tests/filename-parser.test.js tests_py/test_generate_metadata_py.py
git commit -m "feat: parse tv episode filenames"
```

---

### Task 2: Group TV Release Folders Into Series Sources

**Files:**
- Modify: `scripts/generate_metadata.py`
- Modify: `scripts/generate-metadata.js`
- Test: `tests_py/test_generate_metadata_py.py`
- Test: `tests/generate-metadata.test.js`

- [ ] **Step 1: Write failing Python grouping test**

Import `group_series_sources` from `scripts.generate_metadata`, then add:

```python
def test_groups_episode_files_by_show_and_season(self):
    files = [
        "Asterix.and.Obelix.The.Big.Fight.S01.2025.1080p.WEB-DL.DDP5.1.H265-DUTCHFAM/Asterix.and.Obelix.The.Big.Fight.S01E01.2025.1080p.WEB-DL.DDP5.1.H265-DUTCHFAM.mkv",
        "Asterix.and.Obelix.The.Big.Fight.S01.2025.1080p.WEB-DL.DDP5.1.H265-DUTCHFAM/Asterix.and.Obelix.The.Big.Fight.S01E02.2025.1080p.WEB-DL.DDP5.1.H265-DUTCHFAM.mkv",
    ]
    grouped = group_series_sources(files)
    self.assertEqual(len(grouped), 1)
    self.assertEqual(grouped[0]["title"], "Asterix and Obelix The Big Fight")
    self.assertEqual(grouped[0]["year"], 2025)
    self.assertEqual(grouped[0]["seasons"], [1])
    self.assertEqual([episode["episode"] for episode in grouped[0]["episodes"]], [1, 2])
```

- [ ] **Step 2: Write failing Node grouping parity test**

Export and import `groupSeriesSources`, then add to `tests/generate-metadata.test.js`:

```js
test("groups episode files by show and season", () => {
  const grouped = groupSeriesSources([
    "Asterix.and.Obelix.The.Big.Fight.S01.2025.1080p.WEB-DL.DDP5.1.H265-DUTCHFAM/Asterix.and.Obelix.The.Big.Fight.S01E01.2025.1080p.WEB-DL.DDP5.1.H265-DUTCHFAM.mkv",
    "Asterix.and.Obelix.The.Big.Fight.S01.2025.1080p.WEB-DL.DDP5.1.H265-DUTCHFAM/Asterix.and.Obelix.The.Big.Fight.S01E02.2025.1080p.WEB-DL.DDP5.1.H265-DUTCHFAM.mkv"
  ]);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].title, "Asterix and Obelix The Big Fight");
  assert.equal(grouped[0].year, 2025);
  assert.deepEqual(grouped[0].seasons, [1]);
  assert.deepEqual(grouped[0].episodes.map(episode => episode.episode), [1, 2]);
});
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```bash
npm test
```

Expected: failure because `group_series_sources` / `groupSeriesSources` does not exist.

- [ ] **Step 4: Implement Python grouping**

Add to `scripts/generate_metadata.py` after `scan_video_files()`:

```python
def group_series_sources(filenames):
    groups = {}
    for filename in filenames:
        parsed = parse_video_filename(filename)
        if parsed.get("mediaType") != "series":
            continue
        key = (comparable_title(parsed["title"]), parsed.get("year"))
        group = groups.setdefault(key, {"title": parsed["title"], "year": parsed.get("year"), "episodes": []})
        group["episodes"].append(parsed)
    result = []
    for group in groups.values():
        group["episodes"].sort(key=lambda episode: (episode["season"], episode["episode"]))
        group["seasons"] = sorted({episode["season"] for episode in group["episodes"]})
        result.append(group)
    return sorted(result, key=lambda group: comparable_title(group["title"]))
```

- [ ] **Step 5: Implement Node grouping parity**

Add equivalent function to `scripts/generate-metadata.js` after `scanVideoFiles()`:

```js
function groupSeriesSources(filenames) {
  const groups = new Map();
  for (const filename of filenames) {
    const parsed = parseVideoFilename(filename);
    if (parsed.mediaType !== "series") continue;
    const key = `${comparableTitle(parsed.title)}:${parsed.year || ""}`;
    if (!groups.has(key)) groups.set(key, { title: parsed.title, year: parsed.year, episodes: [] });
    groups.get(key).episodes.push(parsed);
  }
  return Array.from(groups.values()).map(group => ({
    ...group,
    episodes: group.episodes.sort((a, b) => a.season - b.season || a.episode - b.episode),
    seasons: Array.from(new Set(group.episodes.map(episode => episode.season))).sort((a, b) => a - b)
  })).sort((a, b) => comparableTitle(a.title).localeCompare(comparableTitle(b.title)));
}
```

Export it from `module.exports`.

- [ ] **Step 6: Run tests and commit**

Run:

```bash
npm test
```

Expected: all tests pass.

Commit:

```bash
git add scripts/generate_metadata.py scripts/generate-metadata.js tests_py/test_generate_metadata_py.py tests/generate-metadata.test.js
git commit -m "feat: group tv episode sources"
```

---

### Task 3: Add IMDb API Client For Series And Episodes

**Files:**
- Modify: `scripts/generate_metadata.py`
- Test: `tests_py/test_generate_metadata_py.py`

- [ ] **Step 1: Write failing URL builder tests**

Import `build_imdbapi_url`, then add:

```python
def test_builds_imdbapi_urls(self):
    self.assertEqual(
        build_imdbapi_url("https://api.imdbapi.dev", "/search/titles", {"query": "Asterix", "limit": 5}),
        "https://api.imdbapi.dev/search/titles?query=Asterix&limit=5",
    )
    self.assertEqual(
        build_imdbapi_url("https://api.imdbapi.dev/", "/titles/tt123/episodes", {"season": 1, "pageSize": 50}),
        "https://api.imdbapi.dev/titles/tt123/episodes?season=1&pageSize=50",
    )
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
python3 -m unittest tests_py/test_generate_metadata_py.py
```

Expected: failure because `build_imdbapi_url` does not exist.

- [ ] **Step 3: Implement URL builder and client skeleton**

Add to `scripts/generate_metadata.py` after ratings/poster helpers:

```python
def build_imdbapi_url(api_url, pathname, params=None):
    base = normalize_api_url(api_url, "https://api.imdbapi.dev")
    query = urlencode({key: value for key, value in (params or {}).items() if value not in (None, "")})
    return f"{base}{pathname}{f'?{query}' if query else ''}"


class ImdbApiClient:
    def __init__(self, api_url):
        self.api_url = normalize_api_url(api_url, "https://api.imdbapi.dev")

    def request(self, pathname, params=None):
        request = Request(build_imdbapi_url(self.api_url, pathname, params), headers={"Accept": "application/json"})
        with urlopen(request, timeout=25) as response:
            return json.loads(response.read().decode("utf-8"))

    def search_titles(self, query, limit=10):
        return self.request("/search/titles", {"query": query, "limit": limit}).get("titles", [])

    def episodes(self, title_id, season):
        episodes = []
        page_token = None
        while True:
            body = self.request("/titles/%s/episodes" % quote(title_id), {"season": season, "pageSize": 50, "pageToken": page_token})
            episodes.extend(body.get("episodes", []))
            page_token = body.get("nextPageToken")
            if not page_token:
                return episodes
```

- [ ] **Step 4: Add title matching helper test**

Add:

```python
def test_selects_imdb_series_search_result(self):
    result = choose_imdb_series_result(
        {"title": "Asterix and Obelix The Big Fight", "year": 2025},
        [
            {"id": "tt111", "type": "movie", "primaryTitle": "Asterix and Obelix The Big Fight", "startYear": 2025},
            {"id": "tt222", "type": "tvSeries", "primaryTitle": "Asterix & Obelix: The Big Fight", "startYear": 2025},
        ],
    )
    self.assertEqual(result["id"], "tt222")
```

- [ ] **Step 5: Implement title matching helper**

Add:

```python
def choose_imdb_series_result(parsed, results):
    series_types = {"tvSeries", "tvMiniSeries", "TV_SERIES", "TV_MINI_SERIES"}
    candidates = [result for result in results if result.get("type") in series_types]
    wanted = comparable_title(parsed["title"])
    exact = [result for result in candidates if wanted in {comparable_title(result.get("primaryTitle")), comparable_title(result.get("originalTitle"))}]
    if parsed.get("year"):
        year_match = next((result for result in exact if result.get("startYear") == parsed["year"]), None)
        if year_match:
            return year_match
    return exact[0] if len(exact) == 1 else (candidates[0] if len(candidates) == 1 else None)
```

- [ ] **Step 6: Run tests and commit**

Run:

```bash
python3 -m unittest tests_py/test_generate_metadata_py.py
```

Expected: all Python generator tests pass.

Commit:

```bash
git add scripts/generate_metadata.py tests_py/test_generate_metadata_py.py
git commit -m "feat: add imdbapi series lookup helpers"
```

---

### Task 4: Generate Series Metadata With Stremio Episode IDs

**Files:**
- Modify: `scripts/generate_metadata.py`
- Test: `tests_py/test_generate_metadata_py.py`

- [ ] **Step 1: Write failing series meta test**

Import `build_series_meta`, then add:

```python
def test_builds_series_meta_with_parent_imdb_episode_video_ids(self):
    source = {
        "title": "Asterix and Obelix The Big Fight",
        "year": 2025,
        "seasons": [1],
        "episodes": [
            {"filename": "Asterix.S01/Asterix.and.Obelix.The.Big.Fight.S01E01.2025.mkv", "title": "Asterix and Obelix The Big Fight", "year": 2025, "season": 1, "episode": 1},
            {"filename": "Asterix.S01/Asterix.and.Obelix.The.Big.Fight.S01E02.2025.mkv", "title": "Asterix and Obelix The Big Fight", "year": 2025, "season": 1, "episode": 2},
        ],
    }
    tmdb_details = {
        "id": 260392,
        "external_ids": {"imdb_id": "tt32145678"},
        "name": "Asterix & Obelix: The Big Fight",
        "original_name": "Astérix & Obélix : Le Combat des chefs",
        "overview": "A Dutch description.",
        "first_air_date": "2025-04-30",
        "poster_path": "/poster.jpg",
        "backdrop_path": "/backdrop.jpg",
        "genres": [{"name": "Animatie"}],
        "credits": {"cast": [{"name": "Alain Chabat"}], "crew": []},
        "images": {"logos": [{"file_path": "/logo.png", "iso_639_1": "nl"}]},
    }
    imdb_episodes = [
        {"id": "tt9000001", "title": "Episode Een", "season": "1", "episodeNumber": 1, "runtimeSeconds": 1320, "plot": "Plot 1"},
        {"id": "tt9000002", "title": "Episode Twee", "season": "1", "episodeNumber": 2, "runtimeSeconds": 1440, "plot": "Plot 2"},
    ]
    meta = build_series_meta(source, tmdb_details, imdb_episodes, "https://tekenfilms.nexioapp.org")
    self.assertEqual(meta["id"], "tt32145678")
    self.assertEqual(meta["type"], "series")
    self.assertEqual(meta["videos"][0]["id"], "tt32145678:1:1")
    self.assertEqual(meta["videos"][0]["episodeImdbId"], "tt9000001")
    self.assertEqual(meta["videos"][0]["videoFilename"], "Asterix.S01/Asterix.and.Obelix.The.Big.Fight.S01E01.2025.mkv")
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
python3 -m unittest tests_py/test_generate_metadata_py.py
```

Expected: failure because `build_series_meta` does not exist.

- [ ] **Step 3: Implement series meta builder**

Add to `scripts/generate_metadata.py` after `build_stremio_meta()`:

```python
def build_episode_video_id(series_id, season, episode):
    return f"{series_id}:{season}:{episode}"


def episode_runtime(seconds):
    if not seconds:
        return None
    minutes = int(seconds) // 60
    return format_runtime(minutes)


def build_series_meta(source, details, imdb_episodes, base_url):
    imdb_id = (details.get("external_ids") or {}).get("imdb_id")
    identifier = imdb_id or f"tmdb:series:{details['id']}"
    episode_lookup = {
        (int(item.get("season") or 0), int(item.get("episodeNumber") or 0)): item
        for item in imdb_episodes
        if item.get("season") and item.get("episodeNumber")
    }
    videos = []
    for episode in source["episodes"]:
        imdb_episode = episode_lookup.get((episode["season"], episode["episode"]), {})
        video = {
            "id": build_episode_video_id(identifier, episode["season"], episode["episode"]),
            "title": imdb_episode.get("title") or f"Aflevering {episode['episode']}",
            "season": episode["season"],
            "episode": episode["episode"],
            "episodeImdbId": imdb_episode.get("id"),
            "overview": imdb_episode.get("plot"),
            "runtime": episode_runtime(imdb_episode.get("runtimeSeconds")),
            "videoFilename": episode["filename"],
            "available": True,
        }
        videos.append({key: value for key, value in video.items() if value is not None})
    first_air_year = get_year(details.get("first_air_date")) or source.get("year")
    meta = {
        "id": identifier,
        "type": "series",
        "name": details.get("name") or source["title"],
        "originalName": details.get("original_name") or details.get("name") or source["title"],
        "releaseInfo": str(first_air_year) if first_air_year else None,
        "released": f"{details['first_air_date']}T00:00:00.000Z" if details.get("first_air_date") else None,
        "poster": local_poster_url(base_url, identifier),
        "logo": pick_logo(details.get("images")),
        "background": image_url("original", details.get("backdrop_path")),
        "description": details.get("overview") or None,
        "genres": [genre["name"] for genre in details.get("genres", []) if genre.get("name")],
        "cast": [person["name"] for person in (details.get("credits", {}).get("cast") or [])[:8] if person.get("name")],
        "tmdbId": details.get("id"),
        "imdbId": imdb_id,
        "videos": videos,
        "behaviorHints": {"hasScheduledVideos": False},
    }
    return {key: value for key, value in meta.items() if value is not None}
```

- [ ] **Step 4: Run tests and commit**

Run:

```bash
python3 -m unittest tests_py/test_generate_metadata_py.py
```

Expected: tests pass.

Commit:

```bash
git add scripts/generate_metadata.py tests_py/test_generate_metadata_py.py
git commit -m "feat: build series metadata"
```

---

### Task 5: Add TMDB TV Lookup And Series Generation Output

**Files:**
- Modify: `scripts/generate_metadata.py`
- Test: `tests_py/test_generate_metadata_py.py`

- [ ] **Step 1: Add TMDB TV client methods**

Add tests for URL intent by using a fake client object in Python, or keep direct helper tests small. Add this method to `TmdbClient`:

```python
    def tv_details_for(self, parsed):
        params = {
            "language": "nl-NL",
            "append_to_response": "credits,images,external_ids",
            "include_image_language": "nl,en,null",
        }
        result = None
        for query in build_query_candidates(parsed["title"]):
            search = self.request(
                "/search/tv",
                {
                    "language": "nl-NL",
                    "query": query,
                    "first_air_date_year": parsed.get("year"),
                    "include_adult": "false",
                },
            )
            result = choose_tmdb_tv_result(parsed, search.get("results", []))
            if result:
                break
        if not result:
            return None
        return self.request(f"/tv/{result['id']}", params)
```

- [ ] **Step 2: Add TV result chooser test**

Add:

```python
def test_chooses_tmdb_tv_result_by_title_and_year(self):
    result = choose_tmdb_tv_result(
        {"title": "Asterix and Obelix The Big Fight", "year": 2025},
        [{"id": 260392, "name": "Asterix & Obelix: The Big Fight", "original_name": "Astérix & Obélix : Le Combat des chefs", "first_air_date": "2025-04-30"}],
    )
    self.assertEqual(result["id"], 260392)
```

- [ ] **Step 3: Implement TV chooser**

Add:

```python
def tv_titles_match(parsed_title, result):
    wanted = comparable_title(parsed_title)
    return wanted in {comparable_title(result.get("name")), comparable_title(result.get("original_name"))}


def choose_tmdb_tv_result(parsed, results):
    exact_matches = [result for result in results if tv_titles_match(parsed["title"], result)]
    if parsed.get("year"):
        exact_year = next((result for result in exact_matches if get_year(result.get("first_air_date")) == parsed["year"]), None)
        if exact_year:
            return exact_year
    return exact_matches[0] if len(exact_matches) == 1 else (results[0] if len(results) == 1 else None)
```

- [ ] **Step 4: Split generation into movie and series phases**

In `generate()`:

1. Keep `filenames = scan_video_files(...)`.
2. Split files:

```python
movie_filenames = [filename for filename in filenames if parse_video_filename(filename).get("mediaType") != "series"]
series_sources = group_series_sources(filenames)
```

3. Existing movie loop uses `movie_filenames`.
4. New series loop:

```python
series_metas = []
for source in series_sources:
    try:
        details = client.tv_details_for(source)
        if not details:
            failures.append({"filename": source["title"], "reason": "no confident TMDB TV match", "parsed": source})
            continue
        imdb_id = (details.get("external_ids") or {}).get("imdb_id")
        imdb_episodes = []
        if imdb_id:
            for season in source["seasons"]:
                imdb_episodes.extend(imdb_client.episodes(imdb_id, season))
        meta = build_series_meta(source, details, imdb_episodes, base_url)
        add_meta_or_duplicate(meta, seen_ids, series_metas, duplicates)
    except Exception as error:
        failures.append({"filename": source["title"], "reason": str(error), "parsed": source})
```

5. Instantiate `imdb_client = ImdbApiClient(env.get("IMDBAPI-DEV_URL") or blueprints["imdbApiBaseUrl"])` near other clients.

- [ ] **Step 5: Update rating merge for series**

When ratings are fetched, include series IDs. For episode ratings, use parent with `episodes=true` only if needed later; first pass only needs series-level rating in catalog:

```python
rating_ids = [meta.get("imdbId") for meta in metas + series_metas]
ratings = ratings_client.bulk(rating_ids)
for meta in metas + series_metas:
    merge_rating(meta, ratings.get(meta.get("imdbId")))
    meta["links"] = build_links(meta)
```

- [ ] **Step 6: Write series outputs**

Modify `write_outputs()` signature to accept `series_metas`:

```python
def write_outputs(root_dir, metas, report, write, series_metas=None):
    series_metas = series_metas or []
    ...
    write_json(data_dir / "catalog.json", {"metas": [build_catalog_meta(meta) for meta in metas]})
    write_json(data_dir / "series-catalog.json", {"metas": [build_catalog_meta(meta) for meta in series_metas]})
    for meta in metas + series_metas:
        write_json(meta_dir / f"{id_to_slug(meta['id'])}.json", meta)
```

- [ ] **Step 7: Update poster downloads for series**

Change `download_posters(root_dir, metas, poster_client)` call to include both lists:

```python
all_metas = metas + series_metas
failures.extend(download_posters(root_dir, all_metas, poster_client))
```

- [ ] **Step 8: Run preview with a fixture directory**

Create a temporary local fixture under `/tmp/tekenfilms-tv-fixture` with empty `.mkv` files matching the Asterix examples. Run:

```bash
VIDEO_DIR=/tmp/tekenfilms-tv-fixture VIDEO_LAYOUT=subfolders npm run generate:preview
```

Expected: the generator attempts TMDB/imdbapi lookups. If API keys are unavailable locally, run only unit tests and document that live preview must be run on HA.

- [ ] **Step 9: Run tests and commit**

Run:

```bash
npm test
```

Expected: all tests pass.

Commit:

```bash
git add scripts/generate_metadata.py tests_py/test_generate_metadata_py.py
git commit -m "feat: generate series metadata"
```

---

### Task 6: Runtime Support For Series Catalog, Meta, And Streams

**Files:**
- Modify: `lib/constants.js`
- Modify: `lib/id.js`
- Modify: `lib/metadata-store.js`
- Modify: `addon.js`
- Test: `tests/addon.test.js`
- Test: `tests/metadata-store.test.js`

- [ ] **Step 1: Write failing metadata-store episode stream test**

Add to `tests/metadata-store.test.js`:

```js
test("builds stream for a series episode video id", () => {
  const meta = {
    id: "tt32145678",
    type: "series",
    videos: [
      {
        id: "tt32145678:1:1",
        title: "Episode Een",
        videoFilename: "Asterix.S01/Asterix.and.Obelix.The.Big.Fight.S01E01.2025.mkv"
      }
    ]
  };
  const stream = buildStreamForVideo(meta, "tt32145678:1:1", "https://tekenfilms.nexioapp.org");
  assert.equal(stream.title, "Episode Een - NL Gesproken");
  assert.equal(stream.url, "https://tekenfilms.nexioapp.org/nl-gesproken/Asterix.S01/Asterix.and.Obelix.The.Big.Fight.S01E01.2025.mkv");
});
```

- [ ] **Step 2: Implement `buildStreamForVideo`**

In `lib/metadata-store.js`, add:

```js
function buildStreamForVideo(meta, videoId, baseUrl) {
  if (!meta) return null;
  if (meta.type !== "series") return buildStreamForMeta(meta, baseUrl);
  const video = (meta.videos || []).find(item => item.id === videoId);
  if (!video || !video.videoFilename) return null;
  return {
    title: `${video.title || "Aflevering"} - NL Gesproken`,
    name: ADDON_NAME,
    url: `${baseUrl}/nl-gesproken/${encodeRelativePath(video.videoFilename)}`
  };
}
```

Export it.

- [ ] **Step 3: Add series constants**

In `lib/constants.js`, add:

```js
const SERIES_CATALOG_ID = "tekenfilms_series_nl";
const SERIES_CATALOG_NAME = "Series (Nederlands)";
```

Export both.

- [ ] **Step 4: Add series catalog loader**

In `lib/metadata-store.js`, add:

```js
function loadSeriesCatalog(dataDir = DATA_DIR) {
  const catalog = readJson(path.join(dataDir, "series-catalog.json"), { metas: [] });
  if (!Array.isArray(catalog.metas)) return { metas: [] };
  return catalog;
}
```

Export it.

- [ ] **Step 5: Write failing addon tests**

In `tests/addon.test.js`, add a series manifest assertion:

```js
assert.ok(manifest.types.includes("series"));
assert.ok(manifest.catalogs.some(catalog => catalog.type === "series" && catalog.id === "tekenfilms_series_nl"));
```

Add handler tests using dependency injection:

```js
test("series catalog handler returns generated series metas", async () => {
  const handlers = createHandlers({
    loadSeriesCatalog: () => ({ metas: [{ id: "tt32145678", type: "series", name: "Asterix" }] })
  });
  assert.deepEqual(await handlers.catalog({ type: "series", id: "tekenfilms_series_nl" }), {
    metas: [{ id: "tt32145678", type: "series", name: "Asterix" }],
    cacheMaxAge: 86400
  });
});

test("series stream handler returns episode stream", async () => {
  const handlers = createHandlers({
    getBaseUrl: () => "https://tekenfilms.nexioapp.org",
    loadMeta: () => ({
      id: "tt32145678",
      type: "series",
      videos: [{ id: "tt32145678:1:1", title: "Episode Een", videoFilename: "Asterix.S01/Asterix.S01E01.mkv" }]
    })
  });
  const result = await handlers.stream({ type: "series", id: "tt32145678:1:1" });
  assert.equal(result.streams[0].url, "https://tekenfilms.nexioapp.org/nl-gesproken/Asterix.S01/Asterix.S01E01.mkv");
});
```

- [ ] **Step 6: Update addon manifest and handlers**

In `addon.js`:

1. Import series constants and store functions.
2. Change `types` to:

```js
types: ["movie", "series"]
```

3. Change resource `types` for `meta` and `stream` to:

```js
types: ["movie", "series"]
```

4. Add catalog:

```js
{
  id: SERIES_CATALOG_ID,
  type: "series",
  name: SERIES_CATALOG_NAME
}
```

5. Update `createHandlers()` store:

```js
loadSeriesCatalog: deps.loadSeriesCatalog || loadSeriesCatalog
```

6. Update catalog handler:

```js
if (type === "movie" && id === CATALOG_ID) return { metas: store.loadCatalog().metas, cacheMaxAge: 86400 };
if (type === "series" && id === SERIES_CATALOG_ID) return { metas: store.loadSeriesCatalog().metas, cacheMaxAge: 86400 };
return { metas: [] };
```

7. Update meta handler to allow `series`.

8. Update stream handler for series video IDs:

```js
if (type === "series") {
  const seriesId = String(id).split(":").slice(0, -2).join(":");
  const slug = idToSlug(seriesId);
  if (!slug) return { streams: [] };
  const meta = store.loadMeta(slug);
  const stream = buildStreamForVideo(meta, id, store.getBaseUrl());
  return stream ? { streams: [stream], cacheMaxAge: 86400 } : { streams: [] };
}
```

- [ ] **Step 7: Update id slug handling**

In `lib/id.js`, support `tmdb:series:<id>`:

```js
if (/^tmdb:series:\d+$/.test(value)) return value.replace(/:/g, "-");
```

Do not allow full episode video IDs as meta slugs; split to parent series ID in the stream handler before calling `idToSlug()`.

- [ ] **Step 8: Run tests and commit**

Run:

```bash
npm test
```

Expected: all tests pass.

Commit:

```bash
git add addon.js lib/constants.js lib/id.js lib/metadata-store.js tests/addon.test.js tests/metadata-store.test.js
git commit -m "feat: serve series catalogs and streams"
```

---

### Task 7: Documentation And Deployment Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README**

Add a TV section after the current video layout docs:

```markdown
## TV Series

TV episodes are supported in one-level release folders. Example:

```text
VIDEO_DIR=/home/jneerdael/Downloads
VIDEO_LAYOUT=subfolders
```

```text
Asterix.and.Obelix.The.Big.Fight.S01.2025.1080p.WEB-DL.DDP5.1.H265-DUTCHFAM/
├── Asterix.and.Obelix.The.Big.Fight.S01E01.2025.1080p.WEB-DL.DDP5.1.H265-DUTCHFAM.mkv
├── Asterix.and.Obelix.The.Big.Fight.S01E02.2025.1080p.WEB-DL.DDP5.1.H265-DUTCHFAM.mkv
└── Asterix.and.Obelix.The.Big.Fight.S01E03.2025.1080p.WEB-DL.DDP5.1.H265-DUTCHFAM.mkv
```

Series IDs use the parent IMDb ID. Episode video IDs use Stremio's IMDb series format: `{seriesImdbId}:{season}:{episode}`.
```

- [ ] **Step 2: Run full verification**

Run:

```bash
git diff --check
npm test
npm run generate:preview
```

Expected: no whitespace errors, tests pass, preview runs. Local preview may show `Sources: 0` if `VIDEO_DIR` points to an empty local folder.

- [ ] **Step 3: Commit docs**

```bash
git add README.md
git commit -m "docs: document tv series layout"
```

- [ ] **Step 4: Push branch**

```bash
git push origin main
```

- [ ] **Step 5: Verify on HA**

On the HA host:

```bash
cd /homeassistant/tekenfilms
git pull
VIDEO_DIR=/homeassistant/dutchfam VIDEO_LAYOUT=subfolders npm run generate:preview
VIDEO_DIR=/homeassistant/dutchfam VIDEO_LAYOUT=subfolders npm run generate:python
docker compose pull tekenfilms
docker compose up -d tekenfilms
```

Then verify public endpoints:

```bash
curl -s https://tekenfilms.nexioapp.org/catalog/series/tekenfilms_series_nl.json | python3 -m json.tool | head -80
curl -s https://tekenfilms.nexioapp.org/meta/series/<series-id>.json | python3 -m json.tool | head -120
curl -s https://tekenfilms.nexioapp.org/stream/series/<series-id>:1:1.json | python3 -m json.tool
```

Expected:

- Series catalog returns at least one series.
- Series meta contains `videos[]`.
- Stream endpoint returns one `https://tekenfilms.nexioapp.org/nl-gesproken/...S01E01....mkv` URL.
- A `HEAD` or range request to that URL returns `200` or `206`.

---

## Self-Review

Spec coverage:

- TV folder example with `S01E01` files: covered by Tasks 1, 2, and 5.
- Parent series IMDb ID as series ID: covered in Key ID Decision and Task 4.
- Episode stream IDs with Stremio parent format: covered in Key ID Decision and Tasks 4 and 6.
- Episode IMDb IDs from imdbapi.dev: covered in Tasks 3 and 4 as `episodeImdbId`.
- Runtime stream support: covered in Task 6.
- Docs and HA verification: covered in Task 7.

Placeholder scan:

- No `TBD`, `TODO`, or undefined later-only functions remain without an implementation step.
- Each new helper has a task that defines it before use in later tasks.

Type consistency:

- Python names use snake_case: `group_series_sources`, `build_series_meta`, `build_episode_video_id`.
- Node names use camelCase: `groupSeriesSources`, `buildStreamForVideo`.
- Generated series video objects consistently use `id`, `title`, `season`, `episode`, `episodeImdbId`, `videoFilename`, `available`.

#!/usr/bin/env python3

import argparse
import json
import os
import re
import shutil
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

ADDON_NAME = "Tekenfilms"
ID_PREFIX = "tekenfilms:"
SUPPORTED_VIDEO_EXTENSIONS = [".avi", ".mkv", ".mp4", ".m4v"]
RELEASE_TAGS = {"bluray", "blu-ray", "dvd", "dvdrip", "webrip", "web-dl", "nl", "nld", "dutch"}
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p"


def read_json(path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return fallback


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def load_env(path):
    values = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def load_api_blueprints(root_dir):
    tmdb = read_json(root_dir / "tmdb.json", {})
    imdb_yaml = (root_dir / "imdbapi.yaml").read_text(encoding="utf-8")
    tmdb_server_url = (
        tmdb.get("data", {})
        .get("api", {})
        .get("schema", {})
        .get("servers", [{}])[0]
        .get("url")
    )
    imdb_host_match = re.search(r"^host:\s*(\S+)", imdb_yaml, flags=re.MULTILINE)
    imdb_host = imdb_host_match.group(1) if imdb_host_match else "api.imdbapi.dev"
    return {
        "tmdbServerUrl": tmdb_server_url or "https://api.themoviedb.org",
        "imdbApiBaseUrl": f"https://{imdb_host}",
    }


def clean_title(value):
    return re.sub(r"\s+", " ", re.sub(r"[._]+", " ", value)).strip()


def parse_video_filename(filename):
    path = Path(filename)
    extension = path.suffix.lower()
    basename = path.stem
    parenthesized_year = re.match(r"^(.*)\((\d{4})\)\s*$", basename)

    if parenthesized_year:
        return {
            "filename": filename,
            "title": clean_title(parenthesized_year.group(1)),
            "year": int(parenthesized_year.group(2)),
            "extension": extension,
        }

    parts = [part for part in re.split(r"[.\s]+", basename) if part]
    year_index = next((index for index, part in enumerate(parts) if re.match(r"^\d{4}$", part)), None)
    if year_index is not None:
        title_parts = []
        for part in parts[:year_index]:
            if part.lower() in RELEASE_TAGS:
                break
            title_parts.append(part)
        return {
            "filename": filename,
            "title": clean_title(" ".join(title_parts)),
            "year": int(parts[year_index]),
            "extension": extension,
        }

    return {
        "filename": filename,
        "title": clean_title(basename),
        "year": None,
        "extension": extension,
    }


def slugify(value):
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char))
    value = value.replace("'", "").replace("’", "").lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def build_movie_id(title, year):
    return f"{ID_PREFIX}{slugify(title)}{f'-{year}' if year else ''}"


def id_to_slug(identifier):
    if re.match(r"^tt\d+$", identifier or ""):
        return identifier
    if re.match(r"^tmdb:\d+$", identifier or ""):
        return identifier.replace(":", "-")
    return identifier[len(ID_PREFIX):] if identifier.startswith(ID_PREFIX) else None


def get_year(release_date):
    match = re.match(r"^(\d{4})", str(release_date or ""))
    return int(match.group(1)) if match else None


def comparable_title(value):
    value = unicodedata.normalize("NFKD", str(value or ""))
    value = "".join(char for char in value if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def titles_match(parsed_title, result):
    wanted = comparable_title(parsed_title)
    return wanted in {
        comparable_title(result.get("title")),
        comparable_title(result.get("original_title")),
    }


def apply_manual_match(parsed, manual_matches):
    override = manual_matches.get(parsed["filename"])
    return {**parsed, **override} if override else parsed


def choose_tmdb_result(parsed, results):
    if not results:
        return None
    exact_matches = [result for result in results if titles_match(parsed["title"], result)]
    if parsed.get("year"):
        exact_year = next((result for result in results if get_year(result.get("release_date")) == parsed["year"]), None)
        if exact_year:
            return exact_year
        near_year = next(
            (
                result
                for result in exact_matches
                if get_year(result.get("release_date")) is not None
                and abs(get_year(result.get("release_date")) - parsed["year"]) <= 1
            ),
            None,
        )
        if near_year:
            return near_year
        return exact_matches[0] if len(exact_matches) == 1 else None
    if len(exact_matches) == 1:
        return exact_matches[0]
    if len(exact_matches) > 1:
        ranked = sorted(exact_matches, key=lambda result: result.get("popularity") or 0, reverse=True)
        top = ranked[0].get("popularity") or 0
        second = ranked[1].get("popularity") or 0
        if top >= 1 and top >= second * 2:
            return ranked[0]
    return results[0] if len(results) == 1 else None


def unique_values(values):
    seen = set()
    unique = []
    for value in values:
        if value and value not in seen:
            seen.add(value)
            unique.append(value)
    return unique


def build_query_candidates(title):
    aliases = {
        "De Reddertjes in Kangeroeland": ["De Reddertjes in Kangoeroeland", "The Rescuers Down Under"],
        "Meet the Robonsons": ["Meet the Robinsons"],
        "Tijgetjes Film": ["Tigger Movie", "The Tigger Movie"],
        "Suske en Wiske De Duistere Diamant": ["Suske Wiske Duistere Diamant", "De duistere diamant"],
    }
    candidates = [title]
    if " en " in title:
        candidates.append(title.replace(" en ", " & "))
    candidates.extend(aliases.get(title, []))
    return unique_values(candidates)


def image_url(size, file_path):
    return f"{TMDB_IMAGE_BASE}/{size}{file_path}" if file_path else None


def normalize_api_url(value, fallback):
    return (value or fallback).rstrip("/")


def format_runtime(minutes):
    if not minutes:
        return None
    hours = int(minutes) // 60
    remaining = int(minutes) % 60
    return f"{hours}h{remaining:02d}min" if hours else f"{remaining}min"


def build_stremio_id(details, parsed):
    if details.get("imdb_id"):
        return details["imdb_id"]
    if details.get("id"):
        return f"tmdb:{details['id']}"
    return build_movie_id(details.get("title") or parsed["title"], parsed.get("year"))


def build_poster_url(api_url, api_key, imdb_id, lang="nl-NL"):
    base = normalize_api_url(api_url, "https://api.top-posters.com")
    url = f"{base}/{quote(api_key)}/imdb/poster/{quote(imdb_id)}.jpg"
    return f"{url}?{urlencode({'lang': lang})}" if lang else url


def build_poster_request_headers():
    return {
        "Accept": "image/jpeg,image/*,*/*",
        "User-Agent": "Mozilla/5.0 (compatible; TekenfilmsMetadataGenerator/0.1; +https://tekenfilms.nexioapp.org)",
    }


def build_ratings_url(api_url):
    base = normalize_api_url(api_url, "https://api.nexioapp.org/v1")
    if base.endswith("/v1"):
        base = base[:-3]
    return f"{base}/v1/ratings/bulk"


def local_poster_url(base_url, identifier):
    return f"{base_url.rstrip().rstrip('/')}/posters/{id_to_slug(identifier)}.jpg"


def stremio_search_url(value):
    return f"stremio:///search?{urlencode({'search': value})}"


def build_links(meta):
    links = []
    if meta.get("imdbId"):
        if meta.get("imdbRating"):
            links.append({"name": meta["imdbRating"], "category": "imdb", "url": f"https://imdb.com/title/{meta['imdbId']}"})
        else:
            links.append({"name": "IMDb", "category": "imdb", "url": f"https://imdb.com/title/{meta['imdbId']}"})
    links.append({"name": meta["name"], "category": "share", "url": f"https://www.strem.io/s/movie/{slugify(meta['name'])}"})
    for genre in meta.get("genres", []):
        links.append({"name": genre, "category": "Genres", "url": stremio_search_url(genre)})
    for person in meta.get("cast", [])[:8]:
        links.append({"name": person, "category": "Cast", "url": stremio_search_url(person)})
    for person in meta.get("director", [])[:3]:
        links.append({"name": person, "category": "Director", "url": stremio_search_url(person)})
    return links


def pick_logo(images):
    logos = (images or {}).get("logos") or []
    logo = (
        next((item for item in logos if item.get("iso_639_1") == "nl"), None)
        or next((item for item in logos if item.get("iso_639_1") == "en"), None)
        or (logos[0] if logos else None)
    )
    return image_url("w500", logo.get("file_path")) if logo else None


def build_stremio_meta(parsed, details, base_url="http://127.0.0.1:7010"):
    year = get_year(details.get("release_date")) or parsed.get("year")
    identifier = build_stremio_id(details, {**parsed, "year": year})
    crew = details.get("credits", {}).get("crew", [])
    cast = details.get("credits", {}).get("cast", [])
    meta = {
        "id": identifier,
        "type": "movie",
        "name": details.get("title") or parsed["title"],
        "originalName": details.get("original_title") or details.get("title") or parsed["title"],
        "videoFilename": parsed["filename"],
        "releaseInfo": str(year) if year else None,
        "released": f"{details['release_date']}T00:00:00.000Z" if details.get("release_date") else None,
        "runtime": format_runtime(details.get("runtime")),
        "poster": local_poster_url(base_url, identifier),
        "logo": pick_logo(details.get("images")),
        "background": image_url("original", details.get("backdrop_path")),
        "description": details.get("overview") or None,
        "genres": [genre["name"] for genre in details.get("genres", []) if genre.get("name")],
        "cast": [person["name"] for person in cast[:8] if person.get("name")],
        "director": [person["name"] for person in crew if person.get("job") == "Director" and person.get("name")],
        "tmdbId": details.get("id"),
        "imdbId": details.get("imdb_id") or None,
        "behaviorHints": {"defaultVideoId": identifier, "hasScheduledVideos": False},
    }
    return {key: value for key, value in meta.items() if value is not None}


def merge_rating(meta, rating):
    if not rating:
        return meta
    average = rating.get("averageRating")
    if average is not None:
        meta["imdbRating"] = f"{float(average):.1f}"
    if rating.get("numVotes") is not None:
        meta["imdbRatingCount"] = rating["numVotes"]
    return meta


def build_catalog_meta(meta):
    allowed = ["id", "type", "name", "poster", "logo", "background", "description", "releaseInfo", "runtime", "imdbRating", "links"]
    return {key: meta[key] for key in allowed if key in meta}


class RatingsClient:
    def __init__(self, api_url, api_key):
        self.url = build_ratings_url(api_url)
        self.api_key = api_key

    def bulk(self, identifiers):
        ids = [identifier for identifier in identifiers if identifier]
        if not ids or not self.api_key:
            return {}
        request = Request(
            self.url,
            data=json.dumps({"identifiers": ids}).encode("utf-8"),
            headers={"Accept": "application/json", "Content-Type": "application/json", "X-API-Key": self.api_key},
            method="POST",
        )
        with urlopen(request, timeout=25) as response:
            body = json.loads(response.read().decode("utf-8"))
        return {item["tconst"]: item for item in body.get("results", [])}


class PosterClient:
    def __init__(self, api_url, api_key):
        self.api_url = normalize_api_url(api_url, "https://api.top-posters.com")
        self.api_key = api_key

    def download(self, imdb_id, destination):
        if not self.api_key or not imdb_id:
            return False
        for lang in ["nl-NL", None]:
            url = build_poster_url(self.api_url, self.api_key, imdb_id, lang)
            try:
                request = Request(url, headers=build_poster_request_headers())
                with urlopen(request, timeout=30) as response:
                    if response.status != 200:
                        continue
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    destination.write_bytes(response.read())
                    return True
            except Exception:
                continue
        return False


class TmdbClient:
    def __init__(self, api_url, api_key):
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key

    def request(self, pathname, params=None):
        if not self.api_key:
            raise RuntimeError("TMDB_API_KEY is missing from .env")
        query = {"api_key": self.api_key}
        query.update({key: value for key, value in (params or {}).items() if value not in (None, "")})
        url = f"{self.api_url}{pathname}?{urlencode(query)}"
        request = Request(url, headers={"Accept": "application/json"})
        with urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))

    def details_for(self, parsed):
        params = {
            "language": "nl-NL",
            "append_to_response": "credits,images",
            "include_image_language": "nl,en,null",
        }
        if parsed.get("tmdbId"):
            return self.request(f"/movie/{parsed['tmdbId']}", params)
        result = None
        for query in build_query_candidates(parsed["title"]):
            query_parsed = {**parsed, "title": query}
            for include_year in [True, False]:
                search = self.request(
                    "/search/movie",
                    {
                        "language": "nl-NL",
                        "query": query,
                        "year": parsed.get("year") if include_year else None,
                        "include_adult": "false",
                    },
                )
                result = choose_tmdb_result(query_parsed, search.get("results", []))
                if result:
                    break
            if result:
                break
        if not result:
            return None
        return self.request(f"/movie/{result['id']}", params)


def resolve_video_layout(layout=None):
    return (layout or os.environ.get("VIDEO_LAYOUT") or os.environ.get("NL_LAYOUT") or "flat").lower()


def scan_video_files(nl_dir, layout=None):
    if not nl_dir.exists():
        raise RuntimeError(f"Missing local video directory: {nl_dir}")
    mode = resolve_video_layout(layout)
    if mode not in {"flat", "subfolders", "auto"}:
        raise RuntimeError(f"Unsupported VIDEO_LAYOUT: {mode}")

    entries = []
    if mode in {"flat", "auto"}:
        entries.extend(path.name for path in nl_dir.iterdir() if path.is_file() and path.suffix.lower() in SUPPORTED_VIDEO_EXTENSIONS)
    if mode in {"subfolders", "auto"}:
        for directory in nl_dir.iterdir():
            if not directory.is_dir():
                continue
            entries.extend(
                path.relative_to(nl_dir).as_posix()
                for path in directory.iterdir()
                if path.is_file() and path.suffix.lower() in SUPPORTED_VIDEO_EXTENSIONS
            )
    return sorted(entries)


def download_posters(root_dir, metas, poster_client):
    if not poster_client:
        return []
    data_dir = root_dir / "data"
    temp_dir = data_dir / "posters.tmp"
    if temp_dir.exists():
        shutil.rmtree(temp_dir)
    temp_dir.mkdir(parents=True, exist_ok=True)
    failures = []
    for meta in metas:
        if not meta.get("imdbId"):
            continue
        destination = temp_dir / f"{id_to_slug(meta['id'])}.jpg"
        if not poster_client.download(meta["imdbId"], destination):
            failures.append({"filename": meta["videoFilename"], "reason": "no top-posters poster available", "id": meta["id"]})
    if failures:
        shutil.rmtree(temp_dir)
        return failures
    poster_dir = data_dir / "posters"
    if poster_dir.exists():
        shutil.rmtree(poster_dir)
    temp_dir.rename(poster_dir)
    return []


def write_outputs(root_dir, metas, report, write):
    data_dir = root_dir / "data"
    meta_dir = data_dir / "meta"
    write_json(data_dir / "generation-report.json", report)
    if not write:
        return
    if meta_dir.exists():
        shutil.rmtree(meta_dir)
    meta_dir.mkdir(parents=True, exist_ok=True)
    write_json(data_dir / "catalog.json", {"metas": [build_catalog_meta(meta) for meta in metas]})
    for meta in metas:
        write_json(meta_dir / f"{id_to_slug(meta['id'])}.json", meta)


def add_meta_or_duplicate(meta, seen_ids, metas, duplicates):
    if meta["id"] in seen_ids:
        duplicates.append({
            "filename": meta["videoFilename"],
            "reason": "duplicate generated id",
            "id": meta["id"],
            "conflictsWith": seen_ids[meta["id"]],
        })
        return False
    seen_ids[meta["id"]] = meta["videoFilename"]
    metas.append(meta)
    return True


def generate(root_dir, write=False):
    env = {**load_env(root_dir / ".env"), **os.environ}
    blueprints = load_api_blueprints(root_dir)
    api_url = env.get("TMDB_API_URL") or f"{blueprints['tmdbServerUrl']}/3/"
    base_url = env.get("BASE_URL") or "http://127.0.0.1:7010"
    client = TmdbClient(api_url, env.get("TMDB_API_KEY"))
    ratings_client = RatingsClient(env.get("IMDBRATINGS_API_URL"), env.get("IMDBRATINGS_API_KEY"))
    poster_client = PosterClient(env.get("TOPPOSTER_API_URL"), env.get("TOPPOSTER_API_KEY"))
    manual_matches = read_json(root_dir / "data" / "manual-matches.json", {})
    filenames = scan_video_files(root_dir / "NL")
    metas = []
    failures = []
    duplicates = []
    seen_ids = {}

    for filename in filenames:
        parsed = apply_manual_match(parse_video_filename(filename), manual_matches)
        try:
            details = client.details_for(parsed)
            if not details:
                failures.append({"filename": filename, "reason": "no confident TMDB match", "parsed": parsed})
                continue
            meta = build_stremio_meta(parsed, details, base_url)
            add_meta_or_duplicate(meta, seen_ids, metas, duplicates)
        except Exception as error:
            failures.append({"filename": filename, "reason": str(error), "parsed": parsed})

    if metas:
        try:
            ratings = ratings_client.bulk([meta.get("imdbId") for meta in metas])
            for meta in metas:
                merge_rating(meta, ratings.get(meta.get("imdbId")))
                meta["links"] = build_links(meta)
        except Exception as error:
            failures.append({"filename": "IMDb ratings", "reason": str(error)})

    if write and not failures:
        failures.extend(download_posters(root_dir, metas, poster_client))

    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "mode": "write" if write else "preview",
        "sourceCount": len(filenames),
        "successCount": len(metas),
        "failureCount": len(failures),
        "duplicateCount": len(duplicates),
        "successes": [
            {
                "filename": meta["videoFilename"],
                "id": meta["id"],
                "name": meta["name"],
                "releaseInfo": meta.get("releaseInfo"),
                "tmdbId": meta.get("tmdbId"),
                "imdbId": meta.get("imdbId"),
            }
            for meta in metas
        ],
        "duplicates": duplicates,
        "failures": failures,
    }
    write_outputs(root_dir, metas, report, write=write and not failures)
    return report


def main():
    parser = argparse.ArgumentParser(description="Preview or generate Tekenfilms Stremio metadata.")
    parser.add_argument("--root", default=Path(__file__).resolve().parents[1], type=Path)
    parser.add_argument("--write", action="store_true", help="write data/catalog.json and data/meta/*.json when all files match")
    args = parser.parse_args()

    try:
        report = generate(args.root.resolve(), write=args.write)
    except Exception as error:
        print(str(error), file=sys.stderr)
        return 1

    print(f"Mode: {report['mode']}")
    print(f"Sources: {report['sourceCount']} | matched: {report['successCount']} | failed: {report['failureCount']}")
    if report["successes"]:
        print("Matched:")
        for success in report["successes"]:
            print(f"- {success['filename']} -> {success['name']} ({success.get('releaseInfo') or 'unknown'}) [{success.get('tmdbId')}]")
    if report["failures"]:
        print("Failures:")
        for failure in report["failures"]:
            print(f"- {failure['filename']}: {failure['reason']}")
        print("See data/generation-report.json for details.")
        return 1
    if report["duplicates"]:
        print("Duplicates:")
        for duplicate in report["duplicates"]:
            print(f"- {duplicate['filename']} duplicates {duplicate['conflictsWith']}; kept first match")
    if args.write:
        print("Wrote data/catalog.json and data/meta/*.json")
    else:
        print("Preview only. Re-run with --write to create catalog/meta files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

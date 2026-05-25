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
from urllib.parse import urlencode
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
    return identifier[len(ID_PREFIX):] if identifier.startswith(ID_PREFIX) else None


def get_year(release_date):
    match = re.match(r"^(\d{4})", str(release_date or ""))
    return int(match.group(1)) if match else None


def apply_manual_match(parsed, manual_matches):
    override = manual_matches.get(parsed["filename"])
    return {**parsed, **override} if override else parsed


def choose_tmdb_result(parsed, results):
    if not results:
        return None
    if parsed.get("year"):
        return next((result for result in results if get_year(result.get("release_date")) == parsed["year"]), None)
    return results[0] if len(results) == 1 else None


def image_url(size, file_path):
    return f"{TMDB_IMAGE_BASE}/{size}{file_path}" if file_path else None


def pick_logo(images):
    logos = (images or {}).get("logos") or []
    logo = (
        next((item for item in logos if item.get("iso_639_1") == "nl"), None)
        or next((item for item in logos if item.get("iso_639_1") == "en"), None)
        or (logos[0] if logos else None)
    )
    return image_url("w500", logo.get("file_path")) if logo else None


def build_stremio_meta(parsed, details):
    year = get_year(details.get("release_date")) or parsed.get("year")
    identifier = build_movie_id(details.get("title") or parsed["title"], year)
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
        "runtime": f"{details['runtime']} min" if details.get("runtime") else None,
        "poster": image_url("w500", details.get("poster_path")),
        "logo": pick_logo(details.get("images")),
        "background": image_url("original", details.get("backdrop_path")),
        "description": details.get("overview") or None,
        "genres": [genre["name"] for genre in details.get("genres", []) if genre.get("name")],
        "cast": [person["name"] for person in cast[:8] if person.get("name")],
        "director": [person["name"] for person in crew if person.get("job") == "Director" and person.get("name")],
        "tmdbId": details.get("id"),
        "imdbId": details.get("imdb_id") or None,
        "behaviorHints": {"defaultVideoId": identifier},
    }
    return {key: value for key, value in meta.items() if value is not None}


def build_catalog_meta(meta):
    allowed = ["id", "type", "name", "poster", "background", "description", "releaseInfo"]
    return {key: meta[key] for key in allowed if key in meta}


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
        search = self.request(
            "/search/movie",
            {
                "language": "nl-NL",
                "query": parsed["title"],
                "year": parsed.get("year"),
                "include_adult": "false",
            },
        )
        result = choose_tmdb_result(parsed, search.get("results", []))
        if not result:
            return None
        return self.request(f"/movie/{result['id']}", params)


def scan_video_files(nl_dir):
    if not nl_dir.exists():
        raise RuntimeError(f"Missing local video directory: {nl_dir}")
    return sorted(path.name for path in nl_dir.iterdir() if path.suffix.lower() in SUPPORTED_VIDEO_EXTENSIONS)


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


def generate(root_dir, write=False):
    env = {**load_env(root_dir / ".env"), **os.environ}
    blueprints = load_api_blueprints(root_dir)
    api_url = env.get("TMDB_API_URL") or f"{blueprints['tmdbServerUrl']}/3/"
    client = TmdbClient(api_url, env.get("TMDB_API_KEY"))
    manual_matches = read_json(root_dir / "data" / "manual-matches.json", {})
    filenames = scan_video_files(root_dir / "NL")
    metas = []
    failures = []
    seen_ids = {}

    for filename in filenames:
        parsed = apply_manual_match(parse_video_filename(filename), manual_matches)
        try:
            details = client.details_for(parsed)
            if not details:
                failures.append({"filename": filename, "reason": "no confident TMDB match", "parsed": parsed})
                continue
            meta = build_stremio_meta(parsed, details)
            if meta["id"] in seen_ids:
                failures.append({
                    "filename": filename,
                    "reason": "duplicate generated id",
                    "id": meta["id"],
                    "conflictsWith": seen_ids[meta["id"]],
                })
                continue
            seen_ids[meta["id"]] = filename
            metas.append(meta)
        except Exception as error:
            failures.append({"filename": filename, "reason": str(error), "parsed": parsed})

    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "mode": "write" if write else "preview",
        "sourceCount": len(filenames),
        "successCount": len(metas),
        "failureCount": len(failures),
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
    if args.write:
        print("Wrote data/catalog.json and data/meta/*.json")
    else:
        print("Preview only. Re-run with --write to create catalog/meta files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

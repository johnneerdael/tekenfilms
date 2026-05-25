import json
import tempfile
import unittest
from pathlib import Path

from scripts.generate_metadata import (
    apply_manual_match,
    build_catalog_meta,
    build_movie_id,
    build_stremio_meta,
    choose_tmdb_result,
    load_api_blueprints,
    parse_video_filename,
    write_outputs,
)


class GenerateMetadataPythonTests(unittest.TestCase):
    def test_parses_release_filenames(self):
        self.assertEqual(
            parse_video_filename("Frozen.2013.BluRay.NL.avi"),
            {
                "filename": "Frozen.2013.BluRay.NL.avi",
                "title": "Frozen",
                "year": 2013,
                "extension": ".avi",
            },
        )
        self.assertEqual(
            parse_video_filename("De Reddertjes in Kangeroeland.m4v"),
            {
                "filename": "De Reddertjes in Kangeroeland.m4v",
                "title": "De Reddertjes in Kangeroeland",
                "year": None,
                "extension": ".m4v",
            },
        )

    def test_applies_manual_match(self):
        parsed = {
            "filename": "De Reddertjes in Kangeroeland.m4v",
            "title": "De Reddertjes in Kangeroeland",
            "year": None,
            "extension": ".m4v",
        }
        manual_matches = {
            "De Reddertjes in Kangeroeland.m4v": {
                "tmdbId": 11135,
                "title": "The Rescuers Down Under",
                "year": 1990,
            }
        }
        self.assertEqual(
            apply_manual_match(parsed, manual_matches),
            {
                "filename": "De Reddertjes in Kangeroeland.m4v",
                "title": "The Rescuers Down Under",
                "year": 1990,
                "extension": ".m4v",
                "tmdbId": 11135,
            },
        )

    def test_chooses_exact_year_match_and_rejects_ambiguous(self):
        self.assertEqual(
            choose_tmdb_result(
                {"title": "Frozen", "year": 2013},
                [
                    {"id": 1, "title": "Frozen", "release_date": "2010-02-05"},
                    {"id": 2, "title": "Frozen", "release_date": "2013-11-27"},
                ],
            )["id"],
            2,
        )
        self.assertIsNone(
            choose_tmdb_result(
                {"title": "Frozen", "year": None},
                [
                    {"id": 1, "title": "Frozen", "release_date": "2010-02-05"},
                    {"id": 2, "title": "Frozen", "release_date": "2013-11-27"},
                ],
            )
        )

    def test_builds_metadata_shapes(self):
        meta = build_stremio_meta(
            {"filename": "Frozen.2013.BluRay.NL.avi", "title": "Frozen", "year": 2013},
            {
                "id": 109445,
                "imdb_id": "tt2294629",
                "title": "Frozen",
                "original_title": "Frozen",
                "overview": "Wanneer een koninkrijk vast komt te zitten in eeuwige winter...",
                "release_date": "2013-11-27",
                "runtime": 102,
                "poster_path": "/poster.jpg",
                "backdrop_path": "/backdrop.jpg",
                "genres": [{"name": "Animatie"}, {"name": "Familie"}],
                "credits": {
                    "cast": [{"name": "Kristen Bell"}],
                    "crew": [{"job": "Director", "name": "Chris Buck"}],
                },
                "images": {"logos": [{"file_path": "/logo.png", "iso_639_1": "nl"}]},
            },
        )
        self.assertEqual(meta["id"], "tekenfilms:frozen-2013")
        self.assertEqual(meta["videoFilename"], "Frozen.2013.BluRay.NL.avi")
        self.assertEqual(meta["poster"], "https://image.tmdb.org/t/p/w500/poster.jpg")
        self.assertEqual(meta["logo"], "https://image.tmdb.org/t/p/w500/logo.png")
        self.assertEqual(meta["background"], "https://image.tmdb.org/t/p/original/backdrop.jpg")
        self.assertEqual(meta["imdbId"], "tt2294629")
        self.assertEqual(meta["genres"], ["Animatie", "Familie"])
        self.assertEqual(build_catalog_meta(meta)["id"], "tekenfilms:frozen-2013")

    def test_write_outputs_supports_preview_and_write(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            meta = {
                "id": "tekenfilms:frozen-2013",
                "type": "movie",
                "name": "Frozen",
                "videoFilename": "Frozen.2013.BluRay.NL.avi",
            }
            report = {"successCount": 1, "failureCount": 0}

            write_outputs(root, [meta], report, write=False)
            self.assertTrue((root / "data" / "generation-report.json").exists())
            self.assertFalse((root / "data" / "meta" / "frozen-2013.json").exists())

            write_outputs(root, [meta], report, write=True)
            catalog = json.loads((root / "data" / "catalog.json").read_text())
            self.assertEqual(catalog["metas"][0]["id"], "tekenfilms:frozen-2013")
            self.assertTrue((root / "data" / "meta" / "frozen-2013.json").exists())

    def test_loads_api_blueprints(self):
        root = Path(__file__).resolve().parents[1]
        blueprints = load_api_blueprints(root)
        self.assertEqual(blueprints["tmdbServerUrl"], "https://api.themoviedb.org")
        self.assertEqual(blueprints["imdbApiBaseUrl"], "https://api.imdbapi.dev")

    def test_slug_removes_diacritics(self):
        self.assertEqual(build_movie_id("101 Echte Dalmatiërs", None), "tekenfilms:101-echte-dalmatiers")


if __name__ == "__main__":
    unittest.main()

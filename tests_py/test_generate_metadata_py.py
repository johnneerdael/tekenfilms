import json
import tempfile
import unittest
from pathlib import Path

from scripts.generate_metadata import (
    add_meta_or_duplicate,
    apply_manual_match,
    build_poster_url,
    build_query_candidates,
    build_catalog_meta,
    build_movie_id,
    build_stremio_meta,
    choose_tmdb_result,
    format_runtime,
    load_api_blueprints,
    merge_rating,
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

    def test_chooses_near_year_for_exact_title_release_date_differences(self):
        self.assertEqual(
            choose_tmdb_result(
                {"title": "De Drie Caballeros", "year": 1945},
                [{"id": 15947, "title": "De Drie Caballeros", "release_date": "1944-12-21"}],
            )["id"],
            15947,
        )

    def test_chooses_single_exact_title_without_year(self):
        self.assertEqual(
            choose_tmdb_result(
                {"title": "101 Echte Dalmatiërs", "year": None},
                [
                    {"id": 11674, "title": "101 Echte Dalmatiërs", "release_date": "1996-11-27"},
                    {"id": 10481, "title": "102 Echte Dalmatiërs", "release_date": "2000-10-07"},
                ],
            )["id"],
            11674,
        )

    def test_chooses_dominant_exact_title_without_year(self):
        self.assertEqual(
            choose_tmdb_result(
                {"title": "Chicken Little", "year": None},
                [
                    {"id": 9982, "title": "Chicken Little", "release_date": "2005-11-04", "popularity": 6.0},
                    {"id": 928883, "title": "Chicken Little", "release_date": "1998-02-23", "popularity": 1.0},
                    {"id": 64648, "title": "Chicken Little", "release_date": "1943-12-17", "popularity": 0.5},
                ],
            )["id"],
            9982,
        )

    def test_chooses_unique_exact_title_even_when_filename_year_is_wrong(self):
        self.assertEqual(
            choose_tmdb_result(
                {"title": "Suske en Wiske De Duistere Diamant", "year": 2014},
                [{"id": 56344, "title": "Suske en Wiske: De duistere diamant", "release_date": "2004-02-14"}],
            )["id"],
            56344,
        )

    def test_builds_query_candidates_for_known_title_variants(self):
        self.assertIn("Meet the Robinsons", build_query_candidates("Meet the Robonsons"))
        self.assertIn("Oliver & Co", build_query_candidates("Oliver en Co"))
        self.assertIn("De Reddertjes in Kangoeroeland", build_query_candidates("De Reddertjes in Kangeroeland"))
        self.assertIn("The Tigger Movie", build_query_candidates("Tijgetjes Film"))

    def test_duplicate_sources_are_reported_without_failing_generation(self):
        metas = [{"id": "tekenfilms:toy-story-1995", "videoFilename": "Toy Story (1995).m4v"}]
        seen_ids = {"tekenfilms:toy-story-1995": "Toy Story (1995).m4v"}
        duplicates = []

        added = add_meta_or_duplicate(
            {"id": "tekenfilms:toy-story-1995", "videoFilename": "Toy.Story.1995.DVD.NL.avi"},
            seen_ids,
            metas,
            duplicates,
        )

        self.assertFalse(added)
        self.assertEqual(len(metas), 1)
        self.assertEqual(duplicates[0]["filename"], "Toy.Story.1995.DVD.NL.avi")
        self.assertEqual(duplicates[0]["conflictsWith"], "Toy Story (1995).m4v")

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
            "https://tekenfilms.nexioapp.org",
        )
        self.assertEqual(meta["id"], "tt2294629")
        self.assertEqual(meta["videoFilename"], "Frozen.2013.BluRay.NL.avi")
        self.assertEqual(meta["poster"], "https://tekenfilms.nexioapp.org/posters/tt2294629.jpg")
        self.assertEqual(meta["logo"], "https://image.tmdb.org/t/p/w500/logo.png")
        self.assertEqual(meta["background"], "https://image.tmdb.org/t/p/original/backdrop.jpg")
        self.assertEqual(meta["imdbId"], "tt2294629")
        self.assertEqual(meta["genres"], ["Animatie", "Familie"])
        self.assertEqual(build_catalog_meta(meta)["id"], "tt2294629")
        self.assertEqual(build_catalog_meta(meta)["logo"], "https://image.tmdb.org/t/p/w500/logo.png")

    def test_merges_imdb_rating_and_formats_runtime(self):
        self.assertEqual(format_runtime(102), "1h42min")
        meta = merge_rating({"id": "tt2294629"}, {"averageRating": 7.4, "numVotes": 123456})
        self.assertEqual(meta["imdbRating"], "7.4")
        self.assertEqual(meta["imdbRatingCount"], 123456)

    def test_builds_dutch_top_posters_url(self):
        self.assertEqual(
            build_poster_url("https://api.top-posters.com", "TP-test", "tt2294629"),
            "https://api.top-posters.com/TP-test/imdb/poster/tt2294629.jpg?lang=nl-NL",
        )
        self.assertEqual(
            build_poster_url("https://api.top-posters.com", "TP-test", "tt2294629", None),
            "https://api.top-posters.com/TP-test/imdb/poster/tt2294629.jpg",
        )

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

import json
import tempfile
import unittest
from pathlib import Path

from scripts.generate_metadata import (
    add_meta_or_duplicate,
    apply_manual_match,
    build_poster_request_headers,
    build_poster_url,
    build_query_candidates,
    build_catalog_meta,
    build_movie_id,
    build_ratings_url,
    build_series_meta,
    build_imdbapi_url,
    build_stremio_meta,
    choose_imdb_series_result,
    choose_tmdb_result,
    choose_tmdb_tv_result,
    format_runtime,
    group_series_sources,
    load_api_blueprints,
    merge_rating,
    parse_mediainfo_json,
    parse_video_filename,
    resolve_video_dir,
    scan_video_files,
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

    def test_chooses_tmdb_tv_result_by_title_and_year(self):
        result = choose_tmdb_tv_result(
            {"title": "Asterix and Obelix The Big Fight", "year": 2025},
            [{"id": 260392, "name": "Asterix & Obelix: The Big Fight", "original_name": "Astérix & Obélix : Le Combat des chefs", "first_air_date": "2025-04-30"}],
        )
        self.assertEqual(result["id"], 260392)

    def test_builds_query_candidates_for_known_title_variants(self):
        self.assertIn("Meet the Robinsons", build_query_candidates("Meet the Robonsons"))
        self.assertIn("Oliver & Co", build_query_candidates("Oliver en Co"))
        self.assertIn("Asterix & Obelix The Big Fight", build_query_candidates("Asterix and Obelix The Big Fight"))
        self.assertIn("De Reddertjes in Kangoeroeland", build_query_candidates("De Reddertjes in Kangeroeland"))
        self.assertIn("The Tigger Movie", build_query_candidates("Tijgetjes Film"))

    def test_scans_either_flat_video_files_or_release_subfolders(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "Frozen.2013.BluRay.NL.avi").write_text("")
            release_dir = root / "Aladdin.1992.2160p.DSNP.WEB-DL.DUAL-DUTCHFAM"
            release_dir.mkdir()
            (release_dir / "aladdin.1992.2160p.dsnp.web-dl.dual-dutchfam.mkv").write_text("")
            (release_dir / "aladdin.1992.nfo").write_text("")

            self.assertEqual(scan_video_files(root, "flat"), ["Frozen.2013.BluRay.NL.avi"])
            self.assertEqual(
                scan_video_files(root, "subfolders"),
                ["Aladdin.1992.2160p.DSNP.WEB-DL.DUAL-DUTCHFAM/aladdin.1992.2160p.dsnp.web-dl.dual-dutchfam.mkv"],
            )
            self.assertEqual(
                scan_video_files(root, "auto"),
                [
                    "Aladdin.1992.2160p.DSNP.WEB-DL.DUAL-DUTCHFAM/aladdin.1992.2160p.dsnp.web-dl.dual-dutchfam.mkv",
                    "Frozen.2013.BluRay.NL.avi",
                ],
            )

    def test_resolves_custom_video_directories_from_env_style_values(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            self.assertEqual(resolve_video_dir(root, {}), root / "NL")
            self.assertEqual(resolve_video_dir(root, {"VIDEO_DIR": "Downloads"}), root / "Downloads")
            self.assertEqual(resolve_video_dir(root, {"VIDEO_DIR": "/mnt/media/tekenfilms"}), Path("/mnt/media/tekenfilms"))

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

    def test_parses_mediainfo_json_into_stream_info(self):
        stream_info = parse_mediainfo_json(
            {
                "media": {
                    "track": [
                        {
                            "@type": "General",
                            "Format": "Matroska",
                            "Duration": "6123000",
                            "FileSize": "8870718508",
                            "OverallBitRate": "11590000",
                        },
                        {
                            "@type": "Video",
                            "Format": "HEVC",
                            "Width": "3840",
                            "Height": "2160",
                            "BitDepth": "10",
                            "FrameRate": "23.976",
                            "HDR_Format": "Dolby Vision / SMPTE ST 2086 HDR10",
                        },
                        {
                            "@type": "Audio",
                            "Format": "E-AC-3",
                            "CommercialName": "Dolby Digital Plus with Dolby Atmos",
                            "Channels": "6",
                            "Language": "nl",
                            "Title": "Dutch",
                            "Default": "Yes",
                        },
                        {
                            "@type": "Audio",
                            "Format": "AAC",
                            "Channels": "2",
                            "Language": "en",
                        },
                    ]
                }
            },
            "Aladdin/aladdin.mkv",
        )

        self.assertEqual(stream_info["source"], "mediainfo")
        self.assertEqual(stream_info["container"], "Matroska")
        self.assertEqual(stream_info["durationMs"], 6123000)
        self.assertEqual(stream_info["sizeBytes"], 8870718508)
        self.assertEqual(stream_info["video"]["resolution"], "2160p")
        self.assertEqual(stream_info["video"]["codec"], "HEVC")
        self.assertEqual(stream_info["video"]["hdr"], ["DV", "HDR10"])
        self.assertEqual(stream_info["audio"]["languages"], ["Dutch", "English"])
        self.assertEqual(stream_info["audio"]["codecs"], ["DD+", "AAC"])
        self.assertEqual(stream_info["audio"]["features"], ["Atmos"])
        self.assertEqual(stream_info["audio"]["channels"], ["5.1", "2.0"])

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

    def test_builds_top_posters_request_headers_accepted_by_cdn(self):
        headers = build_poster_request_headers()
        self.assertEqual(headers["Accept"], "image/jpeg,image/*,*/*")
        self.assertIn("Mozilla", headers["User-Agent"])

    def test_builds_ratings_url_from_root_or_v1_api_base(self):
        self.assertEqual(
            build_ratings_url("https://api.nexioapp.org"),
            "https://api.nexioapp.org/v1/ratings/bulk",
        )
        self.assertEqual(
            build_ratings_url("https://api.nexioapp.org/v1/"),
            "https://api.nexioapp.org/v1/ratings/bulk",
        )

    def test_builds_imdbapi_urls(self):
        self.assertEqual(
            build_imdbapi_url("https://api.imdbapi.dev", "/search/titles", {"query": "Asterix", "limit": 5}),
            "https://api.imdbapi.dev/search/titles?query=Asterix&limit=5",
        )
        self.assertEqual(
            build_imdbapi_url("https://api.imdbapi.dev/", "/titles/tt123/episodes", {"season": 1, "pageSize": 50}),
            "https://api.imdbapi.dev/titles/tt123/episodes?season=1&pageSize=50",
        )

    def test_selects_imdb_series_search_result(self):
        result = choose_imdb_series_result(
            {"title": "Asterix and Obelix The Big Fight", "year": 2025},
            [
                {"id": "tt111", "type": "movie", "primaryTitle": "Asterix and Obelix The Big Fight", "startYear": 2025},
                {"id": "tt222", "type": "tvSeries", "primaryTitle": "Asterix & Obelix: The Big Fight", "startYear": 2025},
            ],
        )
        self.assertEqual(result["id"], "tt222")

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

    def test_write_outputs_writes_series_catalog_and_meta(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            series = {
                "id": "tt32145678",
                "type": "series",
                "name": "Asterix",
                "videos": [{"id": "tt32145678:1:1", "videoFilename": "Asterix/Asterix.S01E01.mkv"}],
            }
            report = {"successCount": 1, "failureCount": 0}

            write_outputs(root, [], report, write=True, series_metas=[series])

            catalog = json.loads((root / "data" / "series-catalog.json").read_text())
            self.assertEqual(catalog["metas"][0]["id"], "tt32145678")
            self.assertTrue((root / "data" / "meta" / "tt32145678.json").exists())

    def test_loads_api_blueprints(self):
        root = Path(__file__).resolve().parents[1]
        blueprints = load_api_blueprints(root)
        self.assertEqual(blueprints["tmdbServerUrl"], "https://api.themoviedb.org")
        self.assertEqual(blueprints["imdbApiBaseUrl"], "https://api.imdbapi.dev")

    def test_slug_removes_diacritics(self):
        self.assertEqual(build_movie_id("101 Echte Dalmatiërs", None), "tekenfilms:101-echte-dalmatiers")


if __name__ == "__main__":
    unittest.main()

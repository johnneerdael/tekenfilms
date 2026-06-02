const test = require("node:test");
const assert = require("node:assert/strict");

const { parseReleaseMetadata, formatStream } = require("../lib/stream-format");

test("parses Nexio-relevant metadata from release subfolder filenames", () => {
  const parsed = parseReleaseMetadata(
    "Aladdin.1992.2160p.DSNP.WEB-DL.DUAL.DDP5.1.DV.HDR10.H265-DUTCHFAM/aladdin.1992.2160p.dsnp.web-dl.dual.ddp5.1.dv.hdr10.h265-dutchfam.mkv"
  );

  assert.equal(parsed.resolution, "2160p");
  assert.equal(parsed.quality, "WEB-DL");
  assert.equal(parsed.encode, "HEVC");
  assert.deepEqual(parsed.visualTags, ["DV", "HDR10"]);
  assert.deepEqual(parsed.audioTags, ["DD+"]);
  assert.deepEqual(parsed.audioChannels, ["5.1"]);
  assert.deepEqual(parsed.languages, ["Dutch", "Dual Audio"]);
  assert.deepEqual(parsed.service, { code: "DSNP", name: "Disney+" });
  assert.equal(parsed.releaseGroup, "DUTCHFAM");
  assert.equal(parsed.container, "mkv");
});

test("formats compact stream title and parseable multiline description", () => {
  const formatted = formatStream("Frozen.2013.1080p.BluRay.NL.H264-DUTCHFAM.mkv", {
    meta: { id: "tt2294629" }
  });

  assert.equal(formatted.title, "NL Gesproken | 1080p | BluRay | AVC");
  assert.deepEqual(formatted.behaviorHints, {
    filename: "Frozen.2013.1080p.BluRay.NL.H264-DUTCHFAM.mkv",
    bingeGroup: "tt2294629|1080p|BluRay|AVC|DUTCHFAM"
  });
  assert.equal(
    formatted.description,
    [
      "Video: 1080p | BluRay | AVC | MKV",
      "Audio: Dutch",
      "Release: DUTCHFAM",
      "File: Frozen.2013.1080p.BluRay.NL.H264-DUTCHFAM.mkv"
    ].join("\n")
  );
});

test("prefers mediainfo streamInfo over filename-derived stream metadata", () => {
  const formatted = formatStream("Movie.2024.WEB-DL.H264.mkv", {
    meta: { id: "tt1234567" },
    streamInfo: {
      source: "mediainfo",
      filename: "Movie.2024.WEB-DL.H264.mkv",
      container: "Matroska",
      durationMs: 6123000,
      sizeBytes: 8870718508,
      overallBitRate: 11590000,
      video: {
        codec: "HEVC",
        width: 3840,
        height: 2160,
        resolution: "2160p",
        hdr: ["DV", "HDR10"]
      },
      audio: {
        languages: ["Dutch", "English"],
        codecs: ["DD+", "AAC"],
        features: ["Atmos"],
        channels: ["5.1", "2.0"]
      },
      audioTracks: [
        { language: "Dutch", codec: "DD+", channels: "5.1", default: true },
        { language: "English", codec: "AAC", channels: "2.0" }
      ]
    }
  });

  assert.equal(formatted.title, "NL Gesproken | 2160p | WEB-DL | HEVC");
  assert.equal(
    formatted.description,
    [
      "Video: 2160p | WEB-DL | HEVC | DV | HDR10 | MKV",
      "Audio: Dutch | English | DD+ | AAC | Atmos | 5.1 | 2.0",
      "Size: 8.87 GB | Runtime: 1h42m | Bitrate: 11.6 Mbps",
      "File: Movie.2024.WEB-DL.H264.mkv"
    ].join("\n")
  );
  assert.equal(formatted.behaviorHints.bingeGroup, "tt1234567|2160p|WEB-DL|HEVC|DV,HDR10|DD+,AAC,Atmos|5.1,2.0");
});

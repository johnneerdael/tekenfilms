const path = require("node:path");

const SEPARATOR = " | ";

const PATTERNS = {
  resolution: [
    ["2160p", /\b(?:2160p|4k|uhd)\b/i],
    ["1440p", /\b(?:1440p|2k|qhd)\b/i],
    ["1080p", /\b(?:1080p|fhd|fullhd)\b/i],
    ["720p", /\b(?:720p|hd)\b/i],
    ["576p", /\b576p\b/i],
    ["480p", /\b(?:480p|sd)\b/i]
  ],
  quality: [
    ["BluRay REMUX", /\b(?:bd|br|uhd)?remux\b/i],
    ["BluRay", /\b(?:blu[ ._-]?ray|b[dr][ ._-]?rip|bd)\b/i],
    ["WEB-DL", /\bweb[ ._-]?dl\b/i],
    ["WEBRip", /\bweb[ ._-]?rip\b/i],
    ["DVDRip", /\bdvd(?:[ ._-]?(?:rip|mux|r|full|5|9))?\b/i],
    ["HDTV", /\b(?:hdtv|tv[ ._-]?rip)\b/i]
  ],
  encode: [
    ["HEVC", /\b(?:hevc|[xh][ ._-]?265|h265)\b/i],
    ["AVC", /\b(?:avc|[xh][ ._-]?264|h264)\b/i],
    ["AV1", /\bav1\b/i],
    ["XviD", /\bxvid\b/i],
    ["DivX", /\bdivx\b/i]
  ],
  visualTags: [
    ["DV", /\b(?:dovi|dolby[ ._-]?vision|dv(?:8[ ._-]?1|7)?)\b/i],
    ["HDR10+", /\bhdr[ ._-]?10(?:[ ._-]?(?:plus|p)|\+)\b/i],
    ["HDR10", /\bhdr[ ._-]?10\b/i],
    ["HDR", /\bhdr\b/i],
    ["HLG", /\bhlg\b/i],
    ["SDR", /\bsdr\b/i],
    ["10bit", /\b(?:10[ ._-]?bit|hi10p?)\b/i]
  ],
  audioTags: [
    ["Atmos", /\batmos\b/i],
    ["DD+", /(?:^|[ ._-])(?:ddp|e[ ._-]?ac[ ._-]?3|dolby[ ._-]?digital[ ._-]?(?:plus|\+))(?=$|[ ._-]|\d)/i],
    ["DD", /\b(?<!e[ ._-]?)ac[ ._-]?3\b|\bdd\b/i],
    ["DTS:X", /\bdts[ .:_-]?x\b/i],
    ["DTS-HD MA", /\bdts[ ._-]?hd[ ._-]?ma\b/i],
    ["DTS-HD", /\bdts[ ._-]?hd\b/i],
    ["DTS", /\bdts\b/i],
    ["TrueHD", /\btrue[ ._-]?hd\b/i],
    ["AAC", /\bq?aac\b/i],
    ["FLAC", /\bflac\b/i]
  ],
  audioChannels: [
    ["7.1", /(?<!\d)7[ ._-]?1(?:ch)?\b/i],
    ["6.1", /(?<!\d)6[ ._-]?1(?:ch)?\b/i],
    ["5.1", /(?<!\d)5[ ._-]?1(?:ch)?\b/i],
    ["2.0", /(?<!\d)2[ ._-]?0(?:ch)?\b/i]
  ],
  languages: [
    ["Dutch", /\b(?:nl|nld|dut|dutch|nederlands)\b/i],
    ["Dual Audio", /\bdual(?:[ ._-]?(?:audio|lang(?:uage)?))?\b/i],
    ["Multi", /\bmulti\b/i],
    ["English", /\b(?:eng|english)\b/i]
  ],
  services: [
    ["DSNP", "Disney+"],
    ["AMZN", "Amazon"],
    ["NF", "Netflix"],
    ["HMAX", "HBO Max"],
    ["MAX", "Max"],
    ["ATVP", "Apple TV+"],
    ["APTV", "Apple TV+"],
    ["PMTP", "Paramount+"],
    ["PCOK", "Peacock"],
    ["CRTC", "Crunchyroll"]
  ]
};

function normalizeParseSource(value) {
  return String(value || "").replace(/[\\/]/g, " ");
}

function firstMatch(source, entries) {
  const found = entries.find(([, pattern]) => pattern.test(source));
  return found ? found[0] : null;
}

function allMatches(source, entries) {
  return entries
    .filter(([, pattern]) => pattern.test(source))
    .map(([value]) => value);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeResolutionFromHeight(height, width) {
  if (!height && !width) return null;
  if (height >= 2000 || width >= 3800) return "2160p";
  if (height >= 1000) return "1080p";
  if (height >= 700) return "720p";
  if (height >= 560) return "576p";
  if (height >= 450) return "480p";
  return null;
}

function normalizeContainer(value) {
  const text = String(value || "").toLowerCase();
  if (!text) return null;
  if (text.includes("matroska")) return "mkv";
  if (text.includes("mpeg-4")) return "mp4";
  if (text.includes("avi")) return "avi";
  if (text.includes("quicktime")) return "mov";
  return text;
}

function releaseFromStreamInfo(streamInfo, fallbackFilename) {
  if (!streamInfo || typeof streamInfo !== "object") return null;
  const video = streamInfo.video || {};
  const audio = streamInfo.audio || {};
  const audioTracks = Array.isArray(streamInfo.audioTracks) ? streamInfo.audioTracks : [];
  const filename = streamInfo.filename || fallbackFilename;
  const fallback = parseReleaseMetadata(filename);
  const width = Number(video.width) || null;
  const height = Number(video.height) || null;
  const languages = unique([
    ...(Array.isArray(audio.languages) ? audio.languages : []),
    ...audioTracks.map(track => track.language),
    "Dutch"
  ]);
  const audioTags = unique([
    ...(Array.isArray(audio.codecs) ? audio.codecs : []),
    ...(Array.isArray(audio.features) ? audio.features : []),
    ...audioTracks.map(track => track.codec),
    ...audioTracks.flatMap(track => Array.isArray(track.features) ? track.features : [])
  ]);
  const audioChannels = unique([
    ...(Array.isArray(audio.channels) ? audio.channels : []),
    ...audioTracks.map(track => track.channels)
  ]);

  return {
    filename,
    resolution: video.resolution || normalizeResolutionFromHeight(height, width) || fallback.resolution,
    quality: fallback.quality,
    encode: video.codec || fallback.encode,
    visualTags: unique([...(Array.isArray(video.hdr) ? video.hdr : []), ...fallback.visualTags]),
    audioTags: audioTags.length ? audioTags : fallback.audioTags,
    audioChannels: audioChannels.length ? audioChannels : fallback.audioChannels,
    languages,
    releaseGroup: fallback.releaseGroup,
    service: fallback.service,
    container: normalizeContainer(streamInfo.container) || fallback.container,
    sizeBytes: streamInfo.sizeBytes,
    durationMs: streamInfo.durationMs,
    overallBitRate: streamInfo.overallBitRate
  };
}

function parseReleaseGroup(relativeFilename) {
  const basename = path.basename(String(relativeFilename || ""), path.extname(String(relativeFilename || "")));
  const separatorIndex = basename.lastIndexOf("-");
  if (separatorIndex < 0 || separatorIndex === basename.length - 1) return null;
  const group = basename.slice(separatorIndex + 1);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(group)) return null;
  return group.toUpperCase();
}

function parseService(source) {
  const padded = ` ${source} `;
  const found = PATTERNS.services.find(([token]) => {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[ ._\\-/])${escaped}(?:$|[ ._\\-/])`, "i").test(padded);
  });
  return found ? { code: found[0], name: found[1] } : null;
}

function parseReleaseMetadata(relativeFilename) {
  const source = normalizeParseSource(relativeFilename);
  const extension = path.extname(String(relativeFilename || "")).replace(".", "").toLowerCase() || null;
  const visualTags = allMatches(source, PATTERNS.visualTags);
  const audioTags = allMatches(source, PATTERNS.audioTags);

  return {
    filename: String(relativeFilename || ""),
    resolution: firstMatch(source, PATTERNS.resolution),
    quality: firstMatch(source, PATTERNS.quality),
    encode: firstMatch(source, PATTERNS.encode),
    visualTags: unique(visualTags.filter(tag => !(tag === "HDR" && visualTags.some(item => item.startsWith("HDR10"))))),
    audioTags: unique(audioTags.filter(tag => !(tag === "DTS" && audioTags.some(item => item.startsWith("DTS-"))))),
    audioChannels: unique(allMatches(source, PATTERNS.audioChannels)),
    languages: unique(["Dutch", ...allMatches(source, PATTERNS.languages)]),
    releaseGroup: parseReleaseGroup(relativeFilename),
    service: parseService(source),
    container: extension
  };
}

function buildBingeGroup(meta, release) {
  const parts = unique([
    meta && meta.id,
    release.resolution,
    release.quality,
    release.encode,
    release.visualTags.join(","),
    release.audioTags.join(","),
    release.audioChannels.join(","),
    release.releaseGroup
  ]);
  return (parts.length ? parts : [release.filename]).join("|");
}

function buildStreamTitle(prefix, release) {
  const parts = [
    prefix || "NL Gesproken",
    release.resolution,
    release.quality,
    release.service && release.service.code,
    release.encode
  ];
  return unique(parts).join(SEPARATOR);
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return null;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1000 && unitIndex < units.length - 1) {
    size /= 1000;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

function formatDuration(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value <= 0) return null;
  const totalSeconds = Math.round(value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours ? `${hours}h${String(minutes).padStart(2, "0")}m` : `${minutes}m`;
}

function formatBitrate(bitsPerSecond) {
  const value = Number(bitsPerSecond);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} Mbps`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} Kbps`;
  return `${Math.round(value)} bps`;
}

function buildStreamDescription(release) {
  const lines = [];
  const hasVideoMetadata = Boolean(
    release.resolution ||
      release.quality ||
      release.service ||
      release.encode ||
      release.visualTags.length
  );
  const videoParts = unique([
    release.resolution,
    release.quality,
    release.service && `${release.service.code} (${release.service.name})`,
    release.encode,
    ...release.visualTags,
    release.container && release.container.toUpperCase()
  ]);
  const audioParts = unique([
    ...release.languages,
    ...release.audioTags,
    ...release.audioChannels
  ]);
  const sourceParts = unique([
    release.sizeBytes && `Size: ${formatBytes(release.sizeBytes)}`,
    release.durationMs && `Runtime: ${formatDuration(release.durationMs)}`,
    release.overallBitRate && `Bitrate: ${formatBitrate(release.overallBitRate)}`,
    release.releaseGroup && `Release: ${release.releaseGroup}`
  ]);

  if (hasVideoMetadata && videoParts.length) lines.push(`Video: ${videoParts.join(SEPARATOR)}`);
  if (audioParts.length) lines.push(`Audio: ${audioParts.join(SEPARATOR)}`);
  if (sourceParts.length) lines.push(sourceParts.join(SEPARATOR));
  if (release.filename) lines.push(`File: ${release.filename}`);

  return lines.join("\n");
}

function formatStream(relativeFilename, { meta = null, titlePrefix = "NL Gesproken", streamInfo = null } = {}) {
  const release = releaseFromStreamInfo(streamInfo, relativeFilename) || parseReleaseMetadata(relativeFilename);
  return {
    title: buildStreamTitle(titlePrefix, release),
    description: buildStreamDescription(release),
    behaviorHints: {
      filename: relativeFilename,
      bingeGroup: buildBingeGroup(meta, release)
    }
  };
}

module.exports = {
  parseReleaseMetadata,
  formatStream
};

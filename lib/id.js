const { ID_PREFIX } = require("./constants");

function slugify(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['']/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildMovieId(title, year) {
  const yearSuffix = year ? `-${year}` : "";
  return `${ID_PREFIX}${slugify(title)}${yearSuffix}`;
}

function idToSlug(id) {
  if (!String(id || "").startsWith(ID_PREFIX)) return null;
  const slug = id.slice(ID_PREFIX.length);
  return slug || null;
}

module.exports = {
  slugify,
  buildMovieId,
  idToSlug
};

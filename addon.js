const { addonBuilder } = require("stremio-addon-sdk");
const {
  ADDON_ID,
  ADDON_NAME,
  CATALOG_ID,
  CATALOG_NAME,
  SERIES_CATALOG_ID,
  SERIES_CATALOG_NAME,
  ID_PREFIX,
  getBaseUrl
} = require("./lib/constants");
const {
  loadCatalog,
  loadSeriesCatalog,
  loadMeta,
  buildStreamForMeta,
  buildStreamForVideo
} = require("./lib/metadata-store");
const { idToSlug } = require("./lib/id");

const manifest = {
  id: ADDON_ID,
  version: "0.1.0",
  name: ADDON_NAME,
  description: "Nederlandstalige tekenfilms uit een lokale collectie.",
  types: ["movie", "series"],
  resources: [
    "catalog",
    {
      name: "meta",
      types: ["movie", "series"],
      idPrefixes: ["tt", "tmdb:", ID_PREFIX]
    },
    {
      name: "stream",
      types: ["movie", "series"],
      idPrefixes: ["tt", "tmdb:", ID_PREFIX]
    }
  ],
  catalogs: [
    {
      id: CATALOG_ID,
      type: "movie",
      name: CATALOG_NAME
    },
    {
      id: SERIES_CATALOG_ID,
      type: "series",
      name: SERIES_CATALOG_NAME
    }
  ],
  behaviorHints: {
    configurable: false,
    configurationRequired: false
  }
};

function createHandlers(deps = {}) {
  const store = {
    getBaseUrl: deps.getBaseUrl || getBaseUrl,
    loadCatalog: deps.loadCatalog || loadCatalog,
    loadSeriesCatalog: deps.loadSeriesCatalog || loadSeriesCatalog,
    loadMeta: deps.loadMeta || loadMeta
  };

  return {
    async catalog({ type, id }) {
      if (type === "movie" && id === CATALOG_ID) {
        return {
          metas: store.loadCatalog().metas,
          cacheMaxAge: 86400
        };
      }
      if (type === "series" && id === SERIES_CATALOG_ID) {
        return {
          metas: store.loadSeriesCatalog().metas,
          cacheMaxAge: 86400
        };
      }
      return { metas: [] };
    },

    async meta({ type, id }) {
      if (!["movie", "series"].includes(type)) return { meta: null };
      const slug = idToSlug(id);
      if (!slug) return { meta: null };
      const meta = store.loadMeta(slug);
      if (!meta) return { meta: null };
      return { meta, cacheMaxAge: 86400 };
    },

    async stream({ type, id }) {
      if (type === "series") {
        const seriesId = String(id).split(":").slice(0, -2).join(":");
        const slug = idToSlug(seriesId);
        if (!slug) return { streams: [] };
        const meta = store.loadMeta(slug);
        const stream = buildStreamForVideo(meta, id, store.getBaseUrl());
        if (!stream) return { streams: [] };
        return { streams: [stream], cacheMaxAge: 86400 };
      }
      if (type !== "movie") return { streams: [] };
      const slug = idToSlug(id);
      if (!slug) return { streams: [] };
      const meta = store.loadMeta(slug);
      const stream = buildStreamForMeta(meta, store.getBaseUrl());
      if (!stream) return { streams: [] };
      return { streams: [stream], cacheMaxAge: 86400 };
    }
  };
}

const builder = new addonBuilder(manifest);
const handlers = createHandlers();

builder.defineCatalogHandler(handlers.catalog);
builder.defineMetaHandler(handlers.meta);
builder.defineStreamHandler(handlers.stream);

module.exports = {
  manifest,
  createHandlers,
  addonInterface: builder.getInterface()
};

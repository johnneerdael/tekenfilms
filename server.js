require("dotenv").config();

const express = require("express");
const { getRouter } = require("stremio-addon-sdk");
const { addonInterface, manifest } = require("./addon");
const { DEFAULT_PORT, POSTER_DIR, VIDEO_DIRS } = require("./lib/constants");

function staticOptions() {
  return {
    fallthrough: true,
    index: false,
    setHeaders(res) {
      res.setHeader("Cache-Control", "public, max-age=86400");
    }
  };
}

function createApp(options = {}) {
  const app = express();
  const videoDirs = options.videoDirs || VIDEO_DIRS;

  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD");
    res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, Range");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range");
    if (req.method === "OPTIONS") return res.status(204).end();
    next();
  });

  app.get("/health", (req, res) => {
    res.status(200).json({ status: "alive" });
  });

  app.get("/manifest.json", (req, res) => {
    res.json(manifest);
  });

  for (const directory of videoDirs.filter(item => item.alias)) {
    app.use(`/nl-gesproken/${directory.alias}`, express.static(directory.path, staticOptions()));
  }

  for (const directory of videoDirs.filter(item => !item.alias)) {
    app.use("/nl-gesproken", express.static(directory.path, staticOptions()));
  }

  app.use("/posters", express.static(POSTER_DIR, {
    fallthrough: true,
    index: false,
    setHeaders(res) {
      res.setHeader("Cache-Control", "public, max-age=604800");
    }
  }));

  app.use("/", getRouter(addonInterface));

  return app;
}

if (require.main === module) {
  const port = process.env.PORT || DEFAULT_PORT;
  createApp().listen(port, "0.0.0.0", () => {
    console.log(`TEKENFILMS ONLINE | PORT ${port}`);
  });
}

module.exports = {
  createApp
};

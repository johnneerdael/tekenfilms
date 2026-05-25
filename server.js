require("dotenv").config();

const express = require("express");
const { getRouter } = require("stremio-addon-sdk");
const { addonInterface, manifest } = require("./addon");
const { DEFAULT_PORT, NL_DIR } = require("./lib/constants");

function createApp() {
  const app = express();

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

  app.use("/nl-gesproken", express.static(NL_DIR, {
    fallthrough: true,
    index: false,
    setHeaders(res) {
      res.setHeader("Cache-Control", "public, max-age=86400");
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

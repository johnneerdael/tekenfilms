const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { createApp } = require("../server");

function listen(app) {
  return new Promise(resolve => {
    const server = app.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

test("serves health and manifest endpoints", async () => {
  const { server, url } = await listen(createApp());
  try {
    const health = await fetch(`${url}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "alive" });

    const manifest = await fetch(`${url}/manifest.json`);
    assert.equal(manifest.status, 200);
    const body = await manifest.json();
    assert.equal(body.id, "org.nexio.tekenfilms");
    assert.equal(body.behaviorHints.configurable, false);
  } finally {
    server.close();
  }
});

test("sets CORS headers", async () => {
  const { server, url } = await listen(createApp());
  try {
    const response = await fetch(`${url}/manifest.json`);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
  } finally {
    server.close();
  }
});

test("serves self-hosted posters", async () => {
  const postersDir = path.join(__dirname, "..", "data", "posters");
  fs.mkdirSync(postersDir, { recursive: true });
  fs.writeFileSync(path.join(postersDir, "test-poster.jpg"), "poster");

  const { server, url } = await listen(createApp());
  try {
    const response = await fetch(`${url}/posters/test-poster.jpg`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "poster");
  } finally {
    server.close();
    fs.rmSync(path.join(postersDir, "test-poster.jpg"), { force: true });
  }
});

test("serves videos from multiple configured directories", async () => {
  const tempRoot = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "tekenfilms-video-roots-"));
  const nlDir = path.join(tempRoot, "NL");
  const nasDir = path.join(tempRoot, "NAS");
  fs.mkdirSync(nlDir);
  fs.mkdirSync(nasDir);
  fs.writeFileSync(path.join(nlDir, "Frozen.avi"), "nl");
  fs.writeFileSync(path.join(nasDir, "Asterix.mkv"), "nas");

  const { server, url } = await listen(createApp({
    videoDirs: [
      { alias: null, path: nlDir },
      { alias: "nas", path: nasDir }
    ]
  }));
  try {
    const nlResponse = await fetch(`${url}/nl-gesproken/Frozen.avi`);
    assert.equal(nlResponse.status, 200);
    assert.equal(await nlResponse.text(), "nl");

    const nasResponse = await fetch(`${url}/nl-gesproken/nas/Asterix.mkv`);
    assert.equal(nasResponse.status, 200);
    assert.equal(await nasResponse.text(), "nas");
  } finally {
    server.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

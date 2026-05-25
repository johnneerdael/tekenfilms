const test = require("node:test");
const assert = require("node:assert/strict");

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

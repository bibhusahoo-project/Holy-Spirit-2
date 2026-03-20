const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const loadAppOrSkip = (t) => {
  try {
    // Lazy require to allow contract tests to run even when dependencies are not installed.
    return require("../app");
  } catch (error) {
    if (error && error.code === "MODULE_NOT_FOUND") {
      t.skip(`Skipping HTTP smoke test: missing dependency ${error.message}`);
      return null;
    }
    throw error;
  }
};

const startTestServer = (app) =>
  new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });

const stopTestServer = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

test("GET /health matches documented success payload", async (t) => {
  const app = loadAppOrSkip(t);
  if (!app) return;
  const { server, baseUrl } = await startTestServer(app);
  try {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { success: true, message: "OK" });
  } finally {
    await stopTestServer(server);
  }
});

test("GET unknown route uses standard error format", async (t) => {
  const app = loadAppOrSkip(t);
  if (!app) return;
  const { server, baseUrl } = await startTestServer(app);
  try {
    const response = await fetch(`${baseUrl}/api/does-not-exist`);
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.success, false);
    assert.equal(typeof body.message, "string");
  } finally {
    await stopTestServer(server);
  }
});

test("GET /api/auth/me without token returns auth error format", async (t) => {
  const app = loadAppOrSkip(t);
  if (!app) return;
  const { server, baseUrl } = await startTestServer(app);
  try {
    const response = await fetch(`${baseUrl}/api/auth/me`);
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.deepEqual(body, { success: false, message: "Authorization token is missing" });
  } finally {
    await stopTestServer(server);
  }
});

test("POST /api/auth/otp/send without mobile returns validation error", async (t) => {
  const app = loadAppOrSkip(t);
  if (!app) return;
  const { server, baseUrl } = await startTestServer(app);
  try {
    const response = await fetch(`${baseUrl}/api/auth/otp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, { success: false, message: "mobile is required" });
  } finally {
    await stopTestServer(server);
  }
});

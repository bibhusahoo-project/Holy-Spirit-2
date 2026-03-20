const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const docsPath = path.join(repoRoot, "API_DOCUMENTATION.md");
const routesDir = path.join(repoRoot, "routes");

const routeBaseByFile = {
  "auth.routes.js": "/api/auth",
  "movie.routes.js": "/api/movies",
  "category.routes.js": "/api/categories",
  "tag.routes.js": "/api/tags",
  "payment.routes.js": "/api/payment",
  "admin.routes.js": "/api/admin",
  "user.routes.js": "/api/user",
};

const normalizePath = (rawPath) => rawPath.split("?")[0].replace(/\/+$/, "") || "/";

const collectDocumentedEndpoints = () => {
  const docs = fs.readFileSync(docsPath, "utf8");
  const regex = /^### (GET|POST|PUT|DELETE|PATCH) `([^`]+)`/gm;
  const endpoints = new Set();
  let match;

  while ((match = regex.exec(docs)) !== null) {
    const method = match[1].toUpperCase();
    const endpointPath = normalizePath(match[2]);
    endpoints.add(`${method} ${endpointPath}`);
  }

  return endpoints;
};

const collectImplementedEndpoints = () => {
  const endpoints = new Set(["GET /health"]);
  const routeFiles = fs.readdirSync(routesDir).filter((name) => name.endsWith(".routes.js"));
  const routeRegex = /router\.(get|post|put|delete|patch)\s*\(\s*["'`]([^"'`]+)["'`]/gim;

  for (const fileName of routeFiles) {
    const basePath = routeBaseByFile[fileName];
    if (!basePath) {
      continue;
    }

    const content = fs.readFileSync(path.join(routesDir, fileName), "utf8");
    let match;
    while ((match = routeRegex.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const childPath = match[2];
      const endpointPath = childPath === "/" ? basePath : `${basePath}${childPath}`;
      endpoints.add(`${method} ${normalizePath(endpointPath)}`);
    }
  }

  return endpoints;
};

test("documented endpoints match implemented routes", () => {
  const documented = collectDocumentedEndpoints();
  const implemented = collectImplementedEndpoints();

  const missingInDocs = [...implemented].filter((ep) => !documented.has(ep));
  const missingInCode = [...documented].filter((ep) => !implemented.has(ep));

  assert.deepEqual(
    missingInDocs,
    [],
    `Endpoints implemented but not documented:\n${missingInDocs.join("\n")}`
  );
  assert.deepEqual(
    missingInCode,
    [],
    `Endpoints documented but not implemented:\n${missingInCode.join("\n")}`
  );
});

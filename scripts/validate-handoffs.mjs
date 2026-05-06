import fs from "node:fs";
import path from "node:path";

const fixtureDir = path.resolve("fixtures/handoffs");
const expectedSchemas = new Set(["tenra-vicina.workflow-handoff.v1"]);
const expectedTargets = new Set(["assembly", "guardrail", "sentinel", "proxy"]);

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? listJsonFiles(fullPath) : entry.name.endsWith(".json") ? [fullPath] : [];
  });
}

const files = listJsonFiles(fixtureDir);
if (files.length === 0) throw new Error("No handoff fixtures found.");

for (const file of files) {
  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!payload || typeof payload !== "object" || typeof payload.schema !== "string") {
    throw new Error(`${file} must contain an object payload with a schema string.`);
  }
  if (!expectedSchemas.has(payload.schema)) {
    throw new Error(`${file} uses an unexpected schema: ${payload.schema}`);
  }
  if (!Array.isArray(payload.targetApps) || payload.targetApps.length === 0) {
    throw new Error(`${file} must route to at least one target app.`);
  }
  for (const target of payload.targetApps) {
    if (!expectedTargets.has(target)) {
      throw new Error(`${file} routes to an unsupported target app: ${target}`);
    }
  }
}

console.log(`Validated ${files.length} Vicina handoff fixture(s).`);

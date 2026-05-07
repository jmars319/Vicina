import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const fixtureDir = path.resolve("fixtures/handoffs");
const registryDocCheck = spawnSync(process.execPath, ["scripts/generate-handoff-registry.mjs", "--check"], {
  stdio: "inherit"
});
if (registryDocCheck.status !== 0) process.exit(registryDocCheck.status ?? 1);
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

function buildGuardrailReview(payload) {
  return {
    schema: "tenra-guardrail.external-action-review.v1",
    sourceApp: "vicina",
    actionKind: "moderation-action",
    actorLabel: "Vicina workflow inbox",
    targetLabel: payload.signal?.title ?? payload.workflow,
    summary: payload.operatorNote,
    evidence: [
      { label: "Workflow", value: payload.workflow },
      { label: "Targets", value: payload.targetApps.join(", ") }
    ],
    recommendedDecision: "review",
    traceId: `vicina-${payload.workflow}-${payload.exportedAtMs}-guardrail`
  };
}

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
  if (payload.targetApps.includes("guardrail")) {
    const review = buildGuardrailReview(payload);
    if (review.schema !== "tenra-guardrail.external-action-review.v1") {
      throw new Error(`${file} must emit the Guardrail external review schema.`);
    }
    if (!review.traceId || !review.traceId.endsWith("-guardrail")) {
      throw new Error(`${file} must emit a stable Vicina Guardrail traceId.`);
    }
    if (review.evidence[1].value !== payload.targetApps.join(", ")) {
      throw new Error(`${file} Guardrail review must preserve target app evidence.`);
    }
  }
}

console.log(`Validated ${files.length} Vicina handoff fixture(s).`);

#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import assert from "node:assert";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const js = readFileSync(ROOT + "exploit.js", "utf8");
const startMarker = "// ====== Closed-loop harness v15 pure helpers ======";
const endMarker = "// ====== End closed-loop harness v15 pure helpers ======";
const start = js.indexOf(startMarker);
const end = js.indexOf(endMarker, start);
assert(start >= 0 && end > start, "closed-loop helper block missing");

const returnNames = [
  "closedLoopPrivatePath",
  "validateClosedLoopConfig",
  "parseClosedLoopHeartbeats",
  "matchClosedLoopExport",
  "matchClosedLoopRootchainVerdict",
  "matchClosedLoopSmokeComplete",
  "parseClosedLoopSolverAnswer",
  "validateCurrentBindingAnswer",
  "formatBucketAnswer",
  "closedLoopCleanupPaths"
];
const helpers = new Function(
  js.slice(start, end + endMarker.length) +
  "\nreturn {" + returnNames.join(",") + "};"
)();

const PRIVATE = "/data/data/org.mozilla.firefox/files";
const SO_SHA = "6b1a84390dd81e7d820678b5bf1ed8e090314f21da80a6611ac7d1abcac4c5a9";
const closedEnv = {
  KS_MMLOOP_MODE: "closed-loop",
  KS_BUCKET_FILE: PRIVATE + "/ks_bucket_classes_v1.txt",
  KS_BUCKET_ANSWER: PRIVATE + "/ks_bucket_answer.txt",
  ROOTCHAIN_MM_PATH: PRIVATE + "/ks_rootchain_mm.txt",
  ROOTCHAIN_MM_BOOT_ID_PATH: PRIVATE + "/ks_rootchain_mm_boot_id.txt",
  ROOTCHAIN_RUN22_GATE_PATH: PRIVATE + "/ks_rootchain_run22_gate.txt",
  ROOTCHAIN_MANIFEST_PATH: PRIVATE + "/ks_rootchain_manifest.txt",
  ROOTCHAIN_ARTIFACT_PATH: PRIVATE + "/res"
};
const smokeConfig = {
  execution: "linker64",
  soSha256: SO_SHA,
  harnessMode: "closed-loop",
  env: { KS_MMLOOP_MODE: "smoke" },
  context: "closed-loop-harness-smoke",
  expectedMarkers: ["MMLOOP smoke marker=complete phase=SPAWN"]
};
const closedConfig = {
  execution: "linker64",
  soSha256: SO_SHA,
  harnessMode: "closed-loop",
  env: closedEnv,
  context: "closed-loop-same-process",
  expectedMarkers: ["MMLOOP export sha256=", "ROOTCHAIN verdict="],
  answerRequired: true
};

assert.deepEqual(helpers.validateClosedLoopConfig(smokeConfig), []);
assert.deepEqual(helpers.validateClosedLoopConfig(closedConfig), []);
assert(helpers.validateClosedLoopConfig({
  ...smokeConfig,
  env: { KS_MMLOOP_MODE: "smoke", KS_BUCKET_FILE: PRIVATE + "/bucket" }
}).some((e) => e.includes("unexpected env")));
assert(helpers.validateClosedLoopConfig({
  ...closedConfig,
  env: { ...closedEnv, KS_RUN33_VALIDATION: "1" }
}).some((e) => e.includes("unexpected env")));

assert.equal(helpers.closedLoopPrivatePath(PRIVATE + "/bucket"), true);
assert.equal(helpers.closedLoopPrivatePath(PRIVATE + "/../evil"), false);
assert.equal(helpers.closedLoopPrivatePath("/data/local/tmp/evil"), false);
assert.equal(helpers.closedLoopPrivatePath(PRIVATE + "/"), false);

const heartbeatText = "MMLOOP heartbeat phase=COLLECT tick=7\n";
assert.deepEqual(helpers.parseClosedLoopHeartbeats(heartbeatText), [{ phase: "COLLECT", tick: 7 }]);
assert.deepEqual(helpers.parseClosedLoopHeartbeats("RUN33_MM_VALIDATION VERDICT=PASS"), []);

assert.deepEqual(helpers.matchClosedLoopExport("MMLOOP export sha256=" + "a".repeat(64)), [{
  sha256: "a".repeat(64), sameEdges: null
}]);
assert.deepEqual(helpers.matchClosedLoopExport("MMLOOP phase=COLLECT PASS bucket_sha256=" + "b".repeat(64) + " same_edges=3"), [{
  sha256: "b".repeat(64), sameEdges: 3
}]);
assert.deepEqual(helpers.matchClosedLoopExport("RUN33_MM_VALIDATION VERDICT=PASS"), []);

assert.equal(helpers.matchClosedLoopRootchainVerdict("ROOTCHAIN verdict=FAIL gate=7 reason=x"), "ROOTCHAIN verdict=FAIL gate=7 reason=x");
assert.equal(helpers.matchClosedLoopRootchainVerdict("RUN33_MM_VALIDATION VERDICT=PASS"), null);
assert.equal(helpers.matchClosedLoopSmokeComplete("MMLOOP smoke marker=complete phase=SPAWN"), true);

const bootId = "01234567-89ab-cdef-0123-456789abcdef";
const bucketHash = "c".repeat(64);
const command = [
  "answer=0x1234567890abcdef",
  "boot_id=" + bootId,
  "model=raw-private",
  "futex_hashsize=0x800",
  "bucket_file_sha256=" + bucketHash,
  "candidates=1",
  "ambiguous=0",
  "answer_verdict=UNIQUE"
].join(" ");
const answer = helpers.parseClosedLoopSolverAnswer(command);
assert.equal(helpers.validateCurrentBindingAnswer(answer, bootId, bucketHash), true);
assert.equal(
  helpers.formatBucketAnswer(answer),
  [
    "BUCKET_ANSWER_V1",
    "answer=0x1234567890abcdef",
    "boot_id=" + bootId,
    "model=raw-private",
    "futex_hashsize=0x800",
    "bucket_file_sha256=" + bucketHash,
    "candidates=1",
    "ambiguous=0",
    "answer_verdict=UNIQUE"
  ].join("\n") + "\n"
);

for (const replacement of [
  { ambiguous: "1" },
  { answer_verdict: "AMBIGUOUS" },
  { answer: "0xABCDEF1234567890" },
  { candidates: "2" }
]) {
  const bad = command.replace(new RegExp("(" + Object.keys(replacement)[0] + ")=[^ ]+"), Object.entries(replacement)[0].join("="));
  assert.throws(() => helpers.parseClosedLoopSolverAnswer(bad));
}
assert.throws(() => helpers.validateCurrentBindingAnswer(answer, "ffffffff-ffff-ffff-ffff-ffffffffffff", bucketHash));
assert.throws(() => helpers.validateCurrentBindingAnswer(answer, bootId, "d".repeat(64)));
assert.throws(() => helpers.parseClosedLoopSolverAnswer(command + " extra=x"));

const jsonAnswer = helpers.parseClosedLoopSolverAnswer(JSON.stringify(answer));
assert.deepEqual(jsonAnswer, answer);
assert.deepEqual(helpers.closedLoopCleanupPaths(closedEnv).length, 12);

const manifest = JSON.parse(readFileSync(ROOT + "manifest.json", "utf8"));
assert.equal(manifest.version, 15);
const devices = (manifest.groups || []).flatMap((group) => group.devices || []);
const smokeEntry = devices.find((device) => device.context === "closed-loop-harness-smoke");
const closedEntry = devices.find((device) => device.context === "closed-loop-same-process");
assert.ok(smokeEntry && closedEntry);
assert.deepEqual(helpers.validateClosedLoopConfig(smokeEntry), []);
assert.deepEqual(helpers.validateClosedLoopConfig(closedEntry), []);

const artifact = readFileSync(ROOT + "so/ghostlock_closed_loop.so");
assert.equal(artifact.length, 215856);
assert.equal(createHash("sha256").update(artifact).digest("hex"), SO_SHA);
assert.equal(artifact.readBigUInt64LE(24).toString(16).toUpperCase(), "2D538");

console.log("PASS config separation");
console.log("PASS env whitelist");
console.log("PASS private paths");
console.log("PASS heartbeat/export/verdict/smoke markers");
console.log("PASS 8-field answer and binding validation");
console.log("PASS manifest v15 smoke/closed-loop entries");
console.log("PASS artifact size/hash/ELF entry");
console.log("HARNESS_V15_SELFTEST=PASS");

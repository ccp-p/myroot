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
  "closedLoopCleanupPaths",
  "formatClosedLoopProvenanceManifest",
  "validateClosedLoopProvenanceManifest",
  "closedLoopProvenanceUploadCommand",
  "closedLoopHeartbeatWatchdog",
  "closedLoopBucketSizeCommand",
  "closedLoopBucketBase64Command",
  "parseClosedLoopDeviceFileSize",
  "decodeBase64ToBytes",
  "validateClosedLoopBucketReadback",
  "closedLoopSolverInputFileName",
  "downloadClosedLoopSolverInput"
];
const helpers = new Function(
  js.slice(start, end + endMarker.length) +
  "\nconst shellQuote = (value) => \"'\" + String(value).replace(/'/g, \"'\\\\''\") + \"'\";\n" +
  "return {" + returnNames.join(",") + "};"
)();

const PRIVATE = "/data/data/org.mozilla.firefox/files";
const SO_SHA = "e7b6a82d825cbd9a0da5027418dda089efdb0a4a7674c10b38d3cef6cb4dab5a";
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

const provenance = helpers.formatClosedLoopProvenanceManifest();
assert.equal(helpers.validateClosedLoopProvenanceManifest(provenance).length, 0);
assert.equal(provenance, "size=214424\nsha256=" + SO_SHA + "\nentry=0x2D1B0\n");
assert.deepEqual(helpers.validateClosedLoopProvenanceManifest(provenance.replace("0x2D1B0", "0x25950")), ["manifest line 3 mismatch"]);
assert.deepEqual(
  helpers.validateClosedLoopProvenanceManifest(provenance.replace(SO_SHA, "9".repeat(64))),
  ["manifest line 2 mismatch"]
);
assert.deepEqual(helpers.validateClosedLoopProvenanceManifest(provenance.replace("214424", "177936")), ["manifest line 1 mismatch"]);
assert.deepEqual(helpers.validateClosedLoopProvenanceManifest(provenance + "extra=x\n"), ["manifest must have exactly 3 lines"]);

const manifestSha = createHash("sha256").update(provenance).digest("hex");
const manifestCommand = helpers.closedLoopProvenanceUploadCommand(closedEnv, provenance, manifestSha);
assert.throws(() => helpers.closedLoopProvenanceUploadCommand(closedEnv, provenance.replace("0x2D1B0", "0x25950"), manifestSha));
assert.throws(() => helpers.closedLoopProvenanceUploadCommand(closedEnv, provenance.replace(SO_SHA, "9".repeat(64)), manifestSha));
assert.throws(() => helpers.closedLoopProvenanceUploadCommand(closedEnv, provenance.replace("214424", "177936"), manifestSha));
assert.match(manifestCommand, /target='\/data\/data\/org\.mozilla\.firefox\/files\/ks_rootchain_manifest\.txt'/);
assert.match(manifestCommand, /tmp='\/data\/data\/org\.mozilla\.firefox\/files\/ks_rootchain_manifest\.txt\.tmp'/);
assert.match(manifestCommand, /\/system\/bin\/printf '%s\\n' 'size=214424'/);
assert.match(manifestCommand, /sha256sum "\$tmp"/);
assert.match(manifestCommand, /\/system\/bin\/mv -f "\$tmp" "\$target"/);
assert.match(manifestCommand, /KS_MANIFEST_UPLOAD=OK/);

const startedAt = 1000000;
assert.deepEqual(helpers.closedLoopHeartbeatWatchdog({
  startedAtMs: startedAt, firstHeartbeatAtMs: null, lastHeartbeatAtMs: null
}, startedAt + 14999), { expired: false });
assert.deepEqual(helpers.closedLoopHeartbeatWatchdog({
  startedAtMs: startedAt, firstHeartbeatAtMs: null, lastHeartbeatAtMs: null
}, startedAt + 15001), { expired: true, reason: "first-heartbeat" });
assert.deepEqual(helpers.closedLoopHeartbeatWatchdog({
  startedAtMs: startedAt, firstHeartbeatAtMs: startedAt + 1000, lastHeartbeatAtMs: startedAt + 1000
}, startedAt + 2500), { expired: false });
assert.deepEqual(helpers.closedLoopHeartbeatWatchdog({
  startedAtMs: startedAt, firstHeartbeatAtMs: startedAt + 1000, lastHeartbeatAtMs: startedAt + 1000
}, startedAt + 16001), { expired: true, reason: "heartbeat-gap" });

const bucketPath = PRIVATE + "/ks_bucket_classes_v1.txt";
assert.match(helpers.closedLoopBucketSizeCommand(bucketPath), /\/system\/bin\/stat -c %s "\$path"/);
assert.match(helpers.closedLoopBucketBase64Command(bucketPath), /\/system\/bin\/base64 '.*ks_bucket_classes_v1\.txt' 2>&1/);
assert.equal(helpers.parseClosedLoopDeviceFileSize("160000"), 160000);
assert.throws(() => helpers.parseClosedLoopDeviceFileSize("160001"));
assert.throws(() => helpers.parseClosedLoopDeviceFileSize("not-a-size"));

const atobPolyfill = (value) => Buffer.from(value, "base64").toString("binary");
const solverInputText = "BUCKET_COLLECT_V1\nboot_id=test\n";
const solverInputBytes = helpers.decodeBase64ToBytes(
  Buffer.from(solverInputText).toString("base64").replace(/(.{16})/g, "$1\n"),
  atobPolyfill
);
assert.equal(Buffer.from(solverInputBytes).toString("binary"), solverInputText);
const solverInputHash = createHash("sha256").update(solverInputBytes).digest("hex");
assert.equal(helpers.validateClosedLoopBucketReadback(solverInputBytes, solverInputHash, solverInputHash), true);
assert.throws(() => helpers.validateClosedLoopBucketReadback(solverInputBytes, solverInputHash, "f".repeat(64)));
assert.throws(() => helpers.validateClosedLoopBucketReadback(new Uint8Array(160001), "f".repeat(64), "f".repeat(64)));
assert.equal(helpers.closedLoopSolverInputFileName(solverInputHash), "ks_bucket_classes_v1_" + solverInputHash.slice(0, 8) + ".txt");
assert.equal(helpers.downloadClosedLoopSolverInput(solverInputBytes, "test.txt", {
  Blob: class FakeBlob {
    constructor(parts, options) {
      this.parts = parts;
      this.options = options;
    }
  },
  URL: {
    createObjectURL: () => "blob:test",
    revokeObjectURL: () => {}
  },
  document: {
    createElement: () => ({ click: () => {}, remove: () => {} }),
    body: { appendChild: () => {} }
  }
}), true);
assert.equal(helpers.downloadClosedLoopSolverInput(solverInputBytes, "test.txt", {}), false);
assert.match(js, /window\.__closedLoopSolverInput = bucketBytes/);

const manifest = JSON.parse(readFileSync(ROOT + "manifest.json", "utf8"));
assert.equal(manifest.version, 15);
const devices = (manifest.groups || []).flatMap((group) => group.devices || []);
const smokeEntry = devices.find((device) => device.context === "closed-loop-harness-smoke");
const closedEntry = devices.find((device) => device.context === "closed-loop-same-process");
assert.ok(smokeEntry && closedEntry);
assert.deepEqual(helpers.validateClosedLoopConfig(smokeEntry), []);
assert.deepEqual(helpers.validateClosedLoopConfig(closedEntry), []);

const indexHtml = readFileSync(ROOT + "index.html", "utf8");
const flowStart = indexHtml.indexOf("async function runDeviceFlow(device)");
const flowEnd = indexHtml.indexOf("btnRun.addEventListener", flowStart);
assert.ok(flowStart >= 0 && flowEnd > flowStart, "runDeviceFlow missing");
const flow = indexHtml.slice(flowStart, flowEnd);
assert.match(flow, /!window\.uploadLinker64AndRun \|\| !window\.uploadClosedLoopAndRun/);
assert.match(flow, /device\.harnessMode === 'closed-loop'/);
assert.match(flow, /device\.context === 'closed-loop-harness-smoke'/);
assert.match(flow, /device\.context === 'closed-loop-same-process'/);
const closedDispatch = flow.indexOf("if (isClosedLoopHarness)");
const closedCall = flow.indexOf("window.uploadClosedLoopAndRun(file, device)");
const oldDispatch = flow.indexOf("} else if (device.execution === 'linker64')");
const oldCall = flow.indexOf("window.uploadLinker64AndRun(file, device)");
assert.ok(closedDispatch >= 0 && oldDispatch > closedDispatch, "closed-loop dispatch missing or out of order");
assert.ok(closedCall > closedDispatch && oldCall > oldDispatch, "harness calls missing");
assert.ok(closedCall < oldDispatch, "closed-loop context leaked into run33 branch");

const oldLinkerStart = js.indexOf("window.uploadLinker64AndRun");
const oldLinkerEnd = js.indexOf(startMarker, oldLinkerStart);
assert.ok(oldLinkerStart >= 0 && oldLinkerEnd > oldLinkerStart, "run33 linker64 function missing");
assert.equal(js.slice(oldLinkerStart, oldLinkerEnd).includes("uploadClosedLoopAndRun"), false);

const artifact = readFileSync(ROOT + "so/ghostlock_closed_loop.so");
assert.equal(artifact.length, 214424);
assert.equal(createHash("sha256").update(artifact).digest("hex"), SO_SHA);
assert.equal(artifact.readBigUInt64LE(24).toString(16).toUpperCase(), "2D1B0");

console.log("PASS config separation");
console.log("PASS env whitelist");
console.log("PASS private paths");
console.log("PASS heartbeat/export/verdict/smoke markers");
console.log("PASS 8-field answer and binding validation");
console.log("PASS manifest v15 smoke/closed-loop entries");
console.log("PASS artifact size/hash/ELF entry");
console.log("PASS provenance manifest fail-closed and atomic upload command");
console.log("PASS first-heartbeat watchdog from spawn");
console.log("PASS closed-loop dispatch and run33 isolation");
console.log("PASS solver bucket readback, hash, limit, and download helper");
console.log("HARNESS_V15_SELFTEST=PASS");

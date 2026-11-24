import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CLI = join(ROOT, "dist", "cli.js");
const REAL = join(ROOT, "examples", "real-corpus");
const COMMIT = "b3279baf9be2207d1a4f4bbd608fd0b591c72aee";

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

async function fetchOk(url) {
  const res = await fetch(url, { redirect: "follow" });
  return res;
}

function isSoftSkip(res) {
  return res.status === 403 || res.status === 429;
}

test("live: npm package name adrgate is still free (404)", async (t) => {
  let res;
  try {
    res = await fetchOk("https://registry.npmjs.org/adrgate");
  } catch {
    t.skip("no network access to the npm registry");
    return;
  }
  if (isSoftSkip(res)) {
    t.skip(`npm registry returned ${res.status}`);
    return;
  }
  assert.equal(res.status, 404, "npm adrgate must 404 (name free)");
});

test("live: org repo techdevfun/adrgate is 404 or 200 (ours after flip)", async (t) => {
  let res;
  try {
    res = await fetchOk("https://api.github.com/repos/techdevfun/adrgate");
  } catch {
    t.skip("no network access to api.github.com");
    return;
  }
  if (isSoftSkip(res)) {
    t.skip(`GitHub API returned ${res.status}`);
    return;
  }
  assert.ok(
    res.status === 404 || res.status === 200,
    `expected 404 (not created) or 200 (ours), got ${res.status}`,
  );
});

test("live: audit of the vendored real corpus finds 9 real UNGOVERNED records", () => {
  const r = run(["audit", REAL]);
  assert.equal(r.status, 1);
  // 9 ADRs plus the corpus README, which is listed as UNKNOWN, not failed.
  assert.ok(
    r.stdout.includes(
      "10 record(s) - 0 GOVERNED, 0 GAPS, 9 UNGOVERNED, 1 UNKNOWN",
    ),
  );
  // Real findings: only 3 of 45 rule checks pass (D2 on 0001, 0004, 0006).
  const passes = r.stdout.split("  PASS ").length - 1;
  assert.equal(passes, 3);
});

test("live: vendored ADR matches the pinned upstream commit byte-for-byte", async (t) => {
  const url = `https://raw.githubusercontent.com/npryce/adr-tools/${COMMIT}/doc/adr/0001-record-architecture-decisions.md`;
  let res;
  try {
    res = await fetchOk(url);
  } catch {
    t.skip("no network access to raw.githubusercontent.com");
    return;
  }
  if (isSoftSkip(res)) {
    t.skip(`raw.githubusercontent.com returned ${res.status}`);
    return;
  }
  assert.equal(res.status, 200);
  const remote = await res.text();
  const local = readFileSync(
    join(REAL, "0001-record-architecture-decisions.md"),
    "utf8",
  );
  const hash = (s) => createHash("sha256").update(s).digest("hex");
  assert.equal(
    hash(remote),
    hash(local),
    "vendored 0001 must match upstream at the pinned commit",
  );
});

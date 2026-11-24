import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CLI = join(ROOT, "dist", "cli.js");
const FIX = join(ROOT, "examples", "fixture");
const REAL = join(ROOT, "examples", "real-corpus");

function run(args, cwd = ROOT) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf8",
  });
}

test("cli: --help exits 0 and lists all five commands", () => {
  const r = run(["--help"]);
  assert.equal(r.status, 0);
  for (const cmd of ["init", "audit", "check", "diff", "explain"]) {
    assert.ok(r.stdout.includes(cmd), `help should list ${cmd}`);
  }
});

test("cli: --version prints 0.1.0", () => {
  const r = run(["--version"]);
  assert.equal(r.status, 0);
  assert.ok(r.stdout.includes("0.1.0"));
});

test("cli: unknown command exits 2", () => {
  const r = run(["frobnicate"]);
  assert.equal(r.status, 2);
  assert.ok(r.stderr.includes("Unknown command"));
});

test("cli: audit on a missing path exits 2", () => {
  const r = run(["audit", join(ROOT, "does-not-exist")]);
  assert.equal(r.status, 2);
});

test("cli: audit fixture exits 1 with the expected summary", () => {
  const r = run(["audit", FIX]);
  assert.equal(r.status, 1);
  assert.ok(r.stdout.includes("1 GOVERNED, 1 GAPS, 1 UNGOVERNED, 1 UNKNOWN"));
});

test("cli: audit --json parses and reports 4 records", () => {
  const r = run(["audit", FIX, "--json"]);
  assert.equal(r.status, 1);
  const report = JSON.parse(r.stdout);
  assert.equal(report.records.length, 4);
  assert.equal(report.summary.governed, 1);
  assert.equal(report.summary.gaps, 1);
  assert.equal(report.summary.ungoverned, 1);
  assert.equal(report.summary.unknown, 1);
});

test("cli: check on the governed fixture alone exits 0", () => {
  const r = run(["check", join(FIX, "governed.md")]);
  assert.equal(r.status, 0);
  assert.ok(r.stdout.includes("GOVERNED"));
});

test("cli: check on the fixture corpus exits 1", () => {
  const r = run(["check", FIX]);
  assert.equal(r.status, 1);
});

test("cli: init scaffolds a record that audits GOVERNED", () => {
  const dir = mkdtempSync(join(tmpdir(), "adrgate-e2e-"));
  const init = run(["init", dir]);
  assert.equal(init.status, 0);
  assert.ok(existsSync(join(dir, "adrgate.config.json")));
  assert.ok(existsSync(join(dir, "0001-use-a-governed-decision-record.md")));
  const audit = run(["audit", dir]);
  assert.equal(audit.status, 0);
  assert.ok(audit.stdout.includes("1 GOVERNED"));
  rmSync(dir, { recursive: true, force: true });
});

test("cli: explain D1 names the Nvidia anchor; explain lists all rules", () => {
  const d1 = run(["explain", "D1"]);
  assert.equal(d1.status, 0);
  assert.ok(d1.stdout.includes("Nvidia"));
  assert.ok(d1.stdout.includes("18/11/2026"));
  const all = run(["explain"]);
  assert.equal(all.status, 0);
  for (const id of ["D1", "D2", "D3", "D4", "D5"]) {
    assert.ok(all.stdout.includes(id));
  }
  assert.ok(all.stdout.includes("never judges whether a decision was right"));
});

test("cli: explain of an unknown rule exits 2", () => {
  const r = run(["explain", "Z9"]);
  assert.equal(r.status, 2);
});

test("cli: diff finds no regression against its own baseline", () => {
  const dir = mkdtempSync(join(tmpdir(), "adrgate-e2e-"));
  const baseline = join(dir, "baseline.json");
  const save = run(["audit", FIX, "--save-baseline", baseline], dir);
  assert.equal(save.status, 1);
  assert.ok(existsSync(baseline));
  const diff = run(["diff", "--baseline", baseline, FIX], dir);
  assert.equal(diff.status, 0);
  assert.ok(diff.stdout.includes("no regressions"));
  rmSync(dir, { recursive: true, force: true });
});

test("cli: diff flags a regression when a governed record loses D1", () => {
  const dir = mkdtempSync(join(tmpdir(), "adrgate-e2e-"));
  const work = join(dir, "adr");
  spawnSync("cp", ["-r", FIX, work], { encoding: "utf8" });
  const baseline = join(dir, "baseline.json");
  const save = run(["audit", work, "--save-baseline", baseline], dir);
  assert.equal(save.status, 1);
  const governedPath = join(work, "governed.md");
  const text = readFileSync(governedPath, "utf8");
  const broken = text.replace(
    /## Reversal\n\n[\s\S]*?\n\n## Consequences/,
    "## Consequences",
  );
  assert.notEqual(broken, text, "the reversal section must be removed");
  writeFileSync(governedPath, broken);
  const diff = run(["diff", "--baseline", baseline, work], dir);
  assert.equal(diff.status, 1);
  assert.ok(diff.stdout.includes("REGRESSION"));
  rmSync(dir, { recursive: true, force: true });
});

test("cli: audit of the real corpus finds 9 real UNGOVERNED records", () => {
  const r = run(["audit", REAL]);
  assert.equal(r.status, 1);
  // 9 ADRs plus the corpus README, which is listed as UNKNOWN, not failed.
  assert.ok(
    r.stdout.includes(
      "10 record(s) - 0 GOVERNED, 0 GAPS, 9 UNGOVERNED, 1 UNKNOWN",
    ),
  );
  assert.ok(r.stdout.includes("0001-record-architecture-decisions.md"));
});

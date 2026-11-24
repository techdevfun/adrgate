import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectFormat, parseRecord, findIsoDate } from "../dist/parse.js";
import { evaluateRules } from "../dist/rules.js";
import { auditFile, diffAgainstBaseline, toBaseline } from "../dist/audit.js";
import { loadConfig } from "../dist/config.js";
import { DEFAULT_CONFIG } from "../dist/types.js";

const ROOT = new URL("..", import.meta.url).pathname;
const FIX = join(ROOT, "examples", "fixture");
const TODAY = new Date("2026-11-24T00:00:00Z");

function readFixture(name) {
  return readFileSync(join(FIX, name), "utf8");
}

function verdictOf(text) {
  const results = evaluateRules(text, DEFAULT_CONFIG, TODAY);
  return results.filter((r) => r.pass).length;
}

// --- parsing ---

test("parse: frontmatter keys are lower-cased and readable", () => {
  const p = parseRecord("---\nStatus: Accepted\nOwner: Ada\n---\n# Title\n");
  assert.equal(p.frontmatter["status"], "Accepted");
  assert.equal(p.frontmatter["owner"], "Ada");
});

test("parse: MADR headings detected", () => {
  const p = parseRecord(
    "# 1. Title\n\n## Context and Problem Statement\n\nx\n\n## Considered Options\n\ny\n\n## Decision Outcome\n\nz\n",
  );
  assert.equal(detectFormat(p), "MADR");
});

test("parse: generic ADR headings detected", () => {
  const p = parseRecord(
    "# 1. Title\n\nDate: 2020-01-01\n\n## Status\n\nAccepted\n\n## Context\n\nx\n",
  );
  assert.equal(detectFormat(p), "GENERIC_ADR");
});

test("parse: RFC frontmatter detected", () => {
  const p = parseRecord(
    "---\nstatus: proposed\nauthor: Ada\ndate: 2026-11-24\n---\n\nBody text.\n",
  );
  assert.equal(detectFormat(p), "RFC");
});

test("parse: free-form notes are UNKNOWN format", () => {
  const p = parseRecord("Meeting notes\n\nWe talked about the queue.\n");
  assert.equal(detectFormat(p), "UNKNOWN");
});

test("parse: markdown and bare links are extracted", () => {
  const p = parseRecord(
    "See [the doc](https://example.com/a) and https://example.com/b\n",
  );
  assert.deepEqual(p.links, ["https://example.com/a", "https://example.com/b"]);
});

test("parse: first ISO date is found", () => {
  assert.equal(
    findIsoDate("Date: 2016-02-12").toISOString().slice(0, 10),
    "2016-02-12",
  );
  assert.equal(findIsoDate("no date here"), null);
});

// --- rules on fixtures ---

test("rules: governed fixture passes 5/5", () => {
  assert.equal(verdictOf(readFixture("governed.md")), 5);
});

test("rules: gaps fixture passes 3/5 (D1 and D4 fail)", () => {
  const results = evaluateRules(readFixture("gaps.md"), DEFAULT_CONFIG, TODAY);
  assert.equal(results.filter((r) => r.pass).length, 3);
  assert.equal(results.find((r) => r.id === "D1").pass, false);
  assert.equal(results.find((r) => r.id === "D4").pass, false);
});

test("rules: ungoverned fixture passes 1/5 (D5 only)", () => {
  const results = evaluateRules(
    readFixture("ungoverned.md"),
    DEFAULT_CONFIG,
    TODAY,
  );
  assert.equal(results.filter((r) => r.pass).length, 1);
  assert.equal(results.find((r) => r.id === "D5").pass, true);
});

test("rules: D1 passes only with a stated condition", () => {
  const withCond =
    "# T\n\n## Status\n\nAccepted\n\n## Decision\n\nWe reverse this decision if latency exceeds 50 ms for 7 days.\n";
  const bare =
    "# T\n\n## Status\n\nAccepted\n\n## Decision\n\nWe may reverse this later.\n";
  assert.equal(evaluateRules(withCond, DEFAULT_CONFIG, TODAY)[0].pass, true);
  assert.equal(evaluateRules(bare, DEFAULT_CONFIG, TODAY)[0].pass, false);
});

test("rules: D2 needs a link plus a date or version", () => {
  const noLink = "# T\n\n## Decision\n\nData from 2026-01-01 shows it works.\n";
  const linkNoDate =
    "# T\n\n## Decision\n\nSee https://example.com/report for details.\n";
  const linkDate =
    "# T\n\n## Decision\n\nSee https://example.com/report (2026-01-01).\n";
  const r = evaluateRules(noLink, DEFAULT_CONFIG, TODAY)[1];
  assert.equal(r.pass, false);
  assert.equal(evaluateRules(linkNoDate, DEFAULT_CONFIG, TODAY)[1].pass, false);
  assert.equal(evaluateRules(linkDate, DEFAULT_CONFIG, TODAY)[1].pass, true);
});

test("rules: D3 rejects a lone 'Alternatives: none'", () => {
  const none = "# T\n\n## Considered Options\n\nAlternatives: none\n";
  const good =
    "# T\n\n## Considered Options\n\n- Option A: stay. Rejected: too slow.\n- Option B: move.\n";
  assert.equal(evaluateRules(none, DEFAULT_CONFIG, TODAY)[2].pass, false);
  assert.equal(evaluateRules(good, DEFAULT_CONFIG, TODAY)[2].pass, true);
});

test("rules: D4 needs a future review date", () => {
  const future = "# T\n\nDate: 2026-11-24\n\nReview date: 2027-06-01\n";
  const past = "# T\n\nDate: 2026-11-24\n\nReview date: 2020-01-01\n";
  const missing = "# T\n\nDate: 2026-11-24\n";
  assert.equal(evaluateRules(future, DEFAULT_CONFIG, TODAY)[3].pass, true);
  assert.equal(evaluateRules(past, DEFAULT_CONFIG, TODAY)[3].pass, false);
  assert.equal(evaluateRules(missing, DEFAULT_CONFIG, TODAY)[3].pass, false);
});

test("rules: D5 needs owner, status, and date together", () => {
  const full =
    "# T\n\nDate: 2026-11-24\n\nOwner: Ada\n\n## Status\n\nAccepted\n";
  const noOwner = "# T\n\nDate: 2026-11-24\n\n## Status\n\nAccepted\n";
  assert.equal(evaluateRules(full, DEFAULT_CONFIG, TODAY)[4].pass, true);
  assert.equal(evaluateRules(noOwner, DEFAULT_CONFIG, TODAY)[4].pass, false);
});

// --- audit / verdicts / config / diff ---

test("audit: fixture verdicts are GOVERNED / GAPS / UNGOVERNED / UNKNOWN", () => {
  assert.equal(
    auditFile(join(FIX, "governed.md"), DEFAULT_CONFIG, TODAY).verdict,
    "GOVERNED",
  );
  assert.equal(
    auditFile(join(FIX, "gaps.md"), DEFAULT_CONFIG, TODAY).verdict,
    "GAPS",
  );
  assert.equal(
    auditFile(join(FIX, "ungoverned.md"), DEFAULT_CONFIG, TODAY).verdict,
    "UNGOVERNED",
  );
  assert.equal(
    auditFile(join(FIX, "unknown.md"), DEFAULT_CONFIG, TODAY).verdict,
    "UNKNOWN",
  );
});

test("config: defaults apply when no config file exists", () => {
  const cfg = loadConfig(
    join(mkdtempSync(join(tmpdir(), "adrgate-")), "none.json"),
  );
  assert.deepEqual(cfg, DEFAULT_CONFIG);
});

test("config: explicit file overrides staleAfterDays", () => {
  const dir = mkdtempSync(join(tmpdir(), "adrgate-"));
  const path = join(dir, "adrgate.config.json");
  writeFileSync(
    path,
    JSON.stringify({ staleAfterDays: 90, requiredRules: ["D1", "D2"] }),
  );
  const cfg = loadConfig(path);
  assert.equal(cfg.staleAfterDays, 90);
  assert.deepEqual(cfg.requiredRules, ["D1", "D2"]);
});

test("config: unparsable config throws", () => {
  const dir = mkdtempSync(join(tmpdir(), "adrgate-"));
  const path = join(dir, "bad.json");
  writeFileSync(path, "{not json");
  assert.throws(() => loadConfig(path), /Cannot parse config/);
});

test("diff: a newly failing rule is a regression, a fixed rule is listed", () => {
  const gov = auditFile(join(FIX, "governed.md"), DEFAULT_CONFIG, TODAY);
  const baseline = {
    version: 1,
    generatedAt: "2026-11-24T00:00:00Z",
    records: {
      "governed.md": { verdict: "GOVERNED", failedRules: [] },
    },
  };
  const report = {
    tool: "adrgate",
    version: "0.1.0",
    auditedAt: "2026-11-24T00:00:00Z",
    records: [{ ...gov, file: join(process.cwd(), "governed.md") }],
    summary: { files: 1, governed: 1, gaps: 0, ungoverned: 0, unknown: 0 },
  };
  const clean = diffAgainstBaseline(report, baseline);
  assert.equal(clean.regressions.length, 0);
  const broken = {
    ...gov,
    verdict: "UNGOVERNED",
    passed: 1,
    rules: gov.rules.map((r) => (r.id === "D1" ? { ...r, pass: false } : r)),
    file: join(process.cwd(), "governed.md"),
  };
  const regressed = diffAgainstBaseline(
    { ...report, records: [broken] },
    baseline,
  );
  assert.ok(regressed.regressions.length >= 1);
  assert.ok(regressed.regressions.some((r) => r.kind === "newly-ungoverned"));
});

test("diff: toBaseline round-trips a report", () => {
  const report = {
    tool: "adrgate",
    version: "0.1.0",
    auditedAt: "2026-11-24T00:00:00Z",
    records: [auditFile(join(FIX, "governed.md"), DEFAULT_CONFIG, TODAY)],
    summary: { files: 1, governed: 1, gaps: 0, ungoverned: 0, unknown: 0 },
  };
  const b = toBaseline(report);
  assert.equal(b.version, 1);
  assert.equal(Object.keys(b.records).length, 1);
});

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { detectFormat, parseRecord } from "./parse.js";
import { evaluateRules } from "./rules.js";
import type {
  AuditReport,
  AuditSummary,
  Baseline,
  DiffResult,
  GateConfig,
  RecordAudit,
  RuleId,
  Verdict,
} from "./types.js";
import { VERSION } from "./types.js";

export function collectMarkdownFiles(inputs: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const input of inputs) {
    const abs = resolve(input);
    if (!existsSync(abs)) {
      throw new Error(`Path not found: ${input}`);
    }
    const st = statSync(abs);
    if (st.isFile()) {
      if (abs.endsWith(".md") && !seen.has(abs)) {
        seen.add(abs);
        out.push(abs);
      }
    } else if (st.isDirectory()) {
      walkDir(abs, out, seen);
    }
  }
  return out.sort();
}

function walkDir(dir: string, out: string[], seen: Set<string>): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      walkDir(full, out, seen);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      if (!seen.has(full)) {
        seen.add(full);
        out.push(full);
      }
    }
  }
}

export function auditFile(
  file: string,
  config: GateConfig,
  today: Date,
): RecordAudit {
  const text = readFileSync(file, "utf8");
  const parsed = parseRecord(text);
  const format = detectFormat(parsed);
  if (format === "UNKNOWN") {
    return {
      file,
      format,
      verdict: "UNKNOWN",
      passed: 0,
      required: config.requiredRules.length,
      rules: [],
    };
  }
  const results = evaluateRules(text, config, today);
  const required = results.filter((r) => config.requiredRules.includes(r.id));
  const passed = required.filter((r) => r.pass).length;
  const verdict: Verdict =
    passed === required.length
      ? "GOVERNED"
      : passed >= Math.ceil(required.length / 2)
        ? "GAPS"
        : "UNGOVERNED";
  return {
    file,
    format,
    verdict,
    passed,
    required: required.length,
    rules: results,
  };
}

export function auditPaths(
  inputs: string[],
  config: GateConfig,
  today: Date = new Date(),
): AuditReport {
  const files = collectMarkdownFiles(inputs);
  if (files.length === 0) {
    throw new Error(
      "No Markdown decision records found under the given paths.",
    );
  }
  const records = files.map((f) => auditFile(f, config, today));
  const summary: AuditSummary = {
    files: records.length,
    governed: records.filter((r) => r.verdict === "GOVERNED").length,
    gaps: records.filter((r) => r.verdict === "GAPS").length,
    ungoverned: records.filter((r) => r.verdict === "UNGOVERNED").length,
    unknown: records.filter((r) => r.verdict === "UNKNOWN").length,
  };
  return {
    tool: "adrgate",
    version: VERSION,
    auditedAt: new Date().toISOString(),
    records,
    summary,
  };
}

/** Exit code for audit/check: 0 all governed, 1 any gaps/ungoverned, 2 error. */
export function exitCodeFor(report: AuditReport): number {
  if (report.summary.gaps > 0 || report.summary.ungoverned > 0) return 1;
  return 0;
}

export function toBaseline(report: AuditReport): Baseline {
  const records: Baseline["records"] = {};
  for (const r of report.records) {
    const key = relative(process.cwd(), r.file);
    records[key] = {
      verdict: r.verdict,
      failedRules: r.rules.filter((x) => !x.pass).map((x) => x.id as RuleId),
    };
  }
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    records,
  };
}

export function diffAgainstBaseline(
  report: AuditReport,
  baseline: Baseline,
): DiffResult {
  const result: DiffResult = {
    regressions: [],
    fixed: [],
    added: [],
    removed: [],
  };
  const seen = new Set<string>();
  for (const r of report.records) {
    const key = relative(process.cwd(), r.file);
    seen.add(key);
    const prev = baseline.records[key];
    if (!prev) {
      result.added.push(key);
      continue;
    }
    const failedNow = new Set(r.rules.filter((x) => !x.pass).map((x) => x.id));
    const newlyFailed = [...failedNow].filter(
      (id) => !prev.failedRules.includes(id as RuleId),
    );
    const newlyFixed = prev.failedRules.filter((id) => !failedNow.has(id));
    if (r.verdict === "UNGOVERNED" && prev.verdict !== "UNGOVERNED") {
      result.regressions.push({
        file: key,
        kind: "newly-ungoverned",
        detail: `Was ${prev.verdict}, now UNGOVERNED (${r.passed}/${r.required} rules pass).`,
      });
    }
    for (const id of newlyFailed) {
      result.regressions.push({
        file: key,
        kind: "new-rule-failure",
        detail: `Rule ${id} now fails (passed in baseline).`,
      });
    }
    if (newlyFixed.length > 0) {
      result.fixed.push({
        file: key,
        detail: `Fixed since baseline: ${newlyFixed.join(", ")}.`,
      });
    }
  }
  for (const key of Object.keys(baseline.records)) {
    if (!seen.has(key)) result.removed.push(key);
  }
  return result;
}

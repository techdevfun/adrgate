import { relative } from "node:path";
import type { AuditReport, DiffResult, RecordAudit } from "./types.js";

/** Word-wrap a line to `width` columns, continuing on `indent`. */
export function wrapLine(text: string, width = 100, indent = "    "): string[] {
  if (text.length <= width) return [text];
  const words = text.split(" ");
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur === "") {
      cur = w;
    } else if (cur.length + 1 + w.length <= width) {
      cur += " " + w;
    } else {
      out.push(cur);
      cur = indent + w;
    }
  }
  if (cur !== "") out.push(cur);
  return out;
}

export function renderHuman(report: AuditReport): string {
  const lines: string[] = [];
  lines.push(`adrgate ${report.version} - decision-record governability audit`);
  lines.push("");
  for (const r of report.records) {
    lines.push(renderRecord(r));
    lines.push("");
  }
  const s = report.summary;
  lines.push(
    `summary: ${s.files} record(s) - ${s.governed} GOVERNED, ${s.gaps} GAPS, ${s.ungoverned} UNGOVERNED, ${s.unknown} UNKNOWN`,
  );
  if (s.gaps > 0 || s.ungoverned > 0) {
    lines.push(
      "verdict: NOT GOVERNED - fix the failing rules above before merging.",
    );
  } else if (s.unknown > 0) {
    lines.push(
      "verdict: GOVERNED (unknown-format records were listed, not failed).",
    );
  } else {
    lines.push("verdict: GOVERNED - every record passes every required rule.");
  }
  return lines.join("\n");
}

export function renderRecord(r: RecordAudit): string {
  const lines: string[] = [];
  // Human output shows the path relative to the working directory, so a
  // demo transcript never leaks the builder's absolute paths. JSON output
  // keeps the full path; baselines already use relative keys.
  const display = relative(process.cwd(), r.file) || r.file;
  lines.push(
    `${display} [${r.format}] - ${r.verdict} (${r.passed}/${r.required})`,
  );
  if (r.verdict === "UNKNOWN") {
    lines.push(
      "  format not recognised (needs Status/Context/Decision headings, MADR headings, or RFC frontmatter). Listed, not failed.",
    );
    return lines.join("\n");
  }
  for (const rule of r.rules) {
    const mark = rule.pass ? "PASS" : "FAIL";
    lines.push(`  ${mark} ${rule.id} ${rule.name}`);
    if (rule.evidence) {
      lines.push(...wrapLine(`    evidence: "${rule.evidence}"`));
    }
    lines.push(...wrapLine(`    ${rule.detail}`));
  }
  return lines.join("\n");
}

export function renderDiff(diff: DiffResult): string {
  const lines: string[] = [];
  if (diff.regressions.length === 0) {
    lines.push("diff: no regressions since baseline.");
  } else {
    lines.push(
      `diff: ${diff.regressions.length} regression(s) since baseline:`,
    );
    for (const r of diff.regressions) {
      lines.push(`  REGRESSION ${r.file} [${r.kind}] - ${r.detail}`);
    }
  }
  for (const f of diff.fixed) {
    lines.push(`  FIXED ${f.file} - ${f.detail}`);
  }
  for (const a of diff.added) {
    lines.push(`  NEW ${a} - not in baseline; audit it before merging.`);
  }
  for (const r of diff.removed) {
    lines.push(`  REMOVED ${r} - was in baseline, no longer present.`);
  }
  return lines.join("\n");
}

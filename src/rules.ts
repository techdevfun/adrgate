import type { GateConfig, RuleId, RuleResult } from "./types.js";
import {
  findIsoDate,
  findIsoDates,
  firstMatchingLine,
  parseRecord,
  sectionContaining,
} from "./parse.js";

const REVERSAL_RE = /\b(reverse|revert|revisit|reconsider|rollback)\b/i;
const REVERSAL_COND_RE =
  /(reverse|revert|revisit|reconsider|rollback)[^.\n]{0,80}\b(if|when|should|unless)\b/i;
const NO_ALTERNATIVES_RE =
  /\b(alternatives?|options?)\s*:\s*(none|n\/a|not applicable|no(ne)?\b)/i;
const REJECTION_RE =
  /\b(rejected|not chosen|discarded|ruled out|downside|drawback|trade-?off|against|cons?)\b/i;
const VERSION_RE = /\bv\d+\.\d+(\.\d+)?\b|version\s+\d+/i;
const ISO_DATE_RE = /\b\d{4}-\d{2}-\d{2}\b/;

function rule(
  id: RuleId,
  name: string,
  pass: boolean,
  evidence: string,
  detail: string,
): RuleResult {
  return { id, name, pass, evidence, detail };
}

function checkD1(lines: string[]): RuleResult {
  const name = "record states reversal conditions";
  const cond = firstMatchingLine(lines, REVERSAL_COND_RE);
  if (cond) {
    return rule("D1", name, true, cond, "Reversal condition stated.");
  }
  const any = firstMatchingLine(lines, REVERSAL_RE);
  if (any) {
    return rule(
      "D1",
      name,
      false,
      any,
      "Mentions reversal but states no condition (no 'if/when/should/unless'). Add the condition that would reverse this decision.",
    );
  }
  return rule(
    "D1",
    name,
    false,
    "",
    "No reversal condition found. Add a section stating under what conditions this decision would be reversed.",
  );
}

function checkD2(text: string, lines: string[], links: string[]): RuleResult {
  const name = "record cites checkable evidence";
  if (links.length === 0) {
    return rule(
      "D2",
      name,
      false,
      "",
      "No cited link found. Cite checkable evidence (data, benchmark, incident, measurement) with a link.",
    );
  }
  const dated = ISO_DATE_RE.test(text) || VERSION_RE.test(text);
  if (!dated) {
    return rule(
      "D2",
      name,
      false,
      links[0],
      "A link is cited but no date or version anchors it. Add the date or version of the evidence so it stays checkable.",
    );
  }
  const ev = firstMatchingLine(lines, /https?:\/\//) ?? links[0];
  return rule(
    "D2",
    name,
    true,
    ev,
    "Link plus a date or version is present. Note: adrgate checks presence and format only; it does not verify that the link supports the claim.",
  );
}

function checkD3(p: ReturnType<typeof parseRecord>): RuleResult {
  const name = "record shows dissent (alternatives + a rejected option)";
  const optionsBody =
    sectionContaining(p, "considered options") ??
    sectionContaining(p, "alternative") ??
    sectionContaining(p, "options");
  if (!optionsBody) {
    return rule(
      "D3",
      name,
      false,
      "",
      "No 'Considered Options' or 'Alternatives' section found. List the options considered and why at least one was rejected.",
    );
  }
  if (NO_ALTERNATIVES_RE.test(optionsBody)) {
    return rule(
      "D3",
      name,
      false,
      firstMatchingLine(optionsBody.split("\n"), NO_ALTERNATIVES_RE) ?? "",
      "The record says there were no alternatives. A decision with no considered alternative is not dissent; record at least one rejected option with a reason.",
    );
  }
  const optionLines = optionsBody
    .split("\n")
    .filter((l) => /^(\s*[-*]|\s*\d+[.)]|\s*#{2,4}\s+)/.test(l));
  const hasRejection = REJECTION_RE.test(optionsBody);
  if (optionLines.length >= 2 && hasRejection) {
    const ev =
      firstMatchingLine(optionsBody.split("\n"), REJECTION_RE) ??
      optionLines[0].trim().slice(0, 160);
    return rule(
      "D3",
      name,
      true,
      ev,
      "At least two options are listed and at least one is rejected with a reason.",
    );
  }
  if (optionLines.length >= 2) {
    return rule(
      "D3",
      name,
      false,
      optionLines[0].trim().slice(0, 160),
      "Options are listed but none is rejected with a reason. Record why at least one option was not chosen.",
    );
  }
  return rule(
    "D3",
    name,
    false,
    optionsBody
      .split("\n")
      .find((l) => l.trim() !== "")
      ?.trim()
      .slice(0, 160) ?? "",
    "Only one option is listed. Record at least one alternative and why it was rejected.",
  );
}

function checkD4(
  p: ReturnType<typeof parseRecord>,
  config: GateConfig,
  today: Date,
): RuleResult {
  const name = "record has a live review date";
  const fm = p.frontmatter;
  const reviewRaw =
    fm["review date"] ??
    fm["review-date"] ??
    fm["review by"] ??
    fm["review-by"] ??
    fm["next review"] ??
    fm["expires"] ??
    fm["expires on"] ??
    fm["expiry"] ??
    null;
  let reviewDate: Date | null = null;
  let evidence = "";
  if (reviewRaw) {
    reviewDate = findIsoDate(reviewRaw);
    evidence = reviewRaw.slice(0, 160);
  } else {
    const line = firstMatchingLine(
      p.lines,
      /(review date|review by|next review|expires?(\s+on)?|expiry)\s*:?\s*\d{4}-\d{2}-\d{2}/i,
    );
    if (line) {
      reviewDate = findIsoDate(line);
      evidence = line;
    }
  }
  if (reviewDate) {
    if (reviewDate.getTime() >= today.getTime()) {
      return rule(
        "D4",
        name,
        true,
        evidence,
        `Review date ${evidence.match(/\d{4}-\d{2}-\d{2}/)?.[0]} is in the future.`,
      );
    }
    return rule(
      "D4",
      name,
      false,
      evidence,
      `Review date ${evidence.match(/\d{4}-\d{2}-\d{2}/)?.[0]} is past. Set a new review date.`,
    );
  }
  const decisionDate = findDecisionDate(p);
  const age = decisionDate
    ? Math.floor(
        (today.getTime() - decisionDate.getTime()) / (1000 * 60 * 60 * 24),
      )
    : null;
  const detail =
    age !== null
      ? `No review date recorded. The decision is ${age} days old; the stale-after threshold is ${config.staleAfterDays} days. Add a review date.`
      : `No review date recorded. Add a review date (stale-after threshold is ${config.staleAfterDays} days).`;
  return rule("D4", name, false, "", detail);
}

function findDecisionDate(p: ReturnType<typeof parseRecord>): Date | null {
  const fm = p.frontmatter;
  if (fm["date"]) return findIsoDate(fm["date"]);
  const line = firstMatchingLine(p.lines, /^date\s*:/i);
  if (line) return findIsoDate(line);
  // A date line near the top of the record (Nygard format: "Date: 2016-02-12").
  const top = p.lines.slice(0, 6).join("\n");
  if (/date/i.test(top)) return findIsoDate(top);
  const dates = findIsoDates(p.text);
  return dates.length > 0 ? dates[0] : null;
}

function checkD5(p: ReturnType<typeof parseRecord>): RuleResult {
  const name = "record names owner, status, and decision date";
  const fm = p.frontmatter;
  const ownerLine = firstMatchingLine(
    p.lines,
    /^(owner|author|decider|deciders?)\s*:/i,
  );
  const owner =
    fm["owner"] ?? fm["author"] ?? fm["decider"] ?? fm["deciders"] ?? null;
  const statusLine = firstMatchingLine(p.lines, /^status\s*:/i);
  const statusBody = sectionContaining(p, "status");
  const statusText = (fm["status"] ?? statusLine ?? statusBody ?? "")
    .replace(/^status\s*:?\s*/i, "")
    .trim();
  const statusKnown =
    /^(accepted|proposed|superseded|deprecated|rejected|draft)\b/i.test(
      statusText,
    );
  const date = findDecisionDate(p);
  const missing: string[] = [];
  if (!owner && !ownerLine) missing.push("owner");
  if (!statusKnown) missing.push("status");
  if (!date) missing.push("decision date");
  if (missing.length === 0) {
    const dateStr = date?.toISOString().slice(0, 10) ?? "";
    return rule(
      "D5",
      name,
      true,
      `owner: ${owner ?? ownerLine?.replace(/^(owner|author|decider|deciders?)\s*:\s*/i, "")}; status: ${statusText.split("\n")[0].slice(0, 40)}; date: ${dateStr}`,
      "Owner, status, and decision date are all present.",
    );
  }
  const evidence = [
    owner ?? ownerLine ?? "",
    statusKnown ? statusText.split("\n")[0].slice(0, 60) : "",
    date ? date.toISOString().slice(0, 10) : "",
  ]
    .filter(Boolean)
    .join(" | ");
  return rule(
    "D5",
    name,
    false,
    evidence,
    `Missing: ${missing.join(", ")}. A governable record names who decided, when, and whether it is proposed, accepted, or superseded.`,
  );
}

export function evaluateRules(
  text: string,
  config: GateConfig,
  today: Date,
): RuleResult[] {
  const p = parseRecord(text);
  return [
    checkD1(p.lines),
    checkD2(text, p.lines, p.links),
    checkD3(p),
    checkD4(p, config, today),
    checkD5(p),
  ];
}

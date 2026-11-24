/** Rule explanations. The Nvidia timeline anchor is dated 23/11/2026. */
export interface RuleDoc {
  id: string;
  title: string;
  what: string;
  why: string;
  anchor: string;
  threshold: string;
  source: string;
}

export const RULE_DOCS: RuleDoc[] = [
  {
    id: "D1",
    title: "D1 REVERSAL - the record states reversal conditions",
    what: "The record must state the conditions under which the decision would be reversed, in its own words (for example: 'We reverse this decision if latency exceeds 200 ms for 7 consecutive days'). A bare mention of the word 'reverse' is not enough; a condition (if / when / should / unless) must be present.",
    why: "Without a reversal condition, a reversal looks arbitrary and nobody can say what changed. The decision can be undone silently, and the next team inherits a choice with no tripwire.",
    anchor:
      "On 18/11/2026 Nvidia's board said it had no intention of reinstating Jensen Huang as CEO; on 22/11/2026 it voted unanimously to bring him back, and on 23/11/2026 Nvidia announced the reversal. No published reversal condition explains what changed in five days.",
    threshold:
      "Pass: a reversal-condition sentence is present. Fail: no reversal language, or reversal mentioned without a condition.",
    source:
      "Nvidia timeline as reported 23/11/2026 (Morningstar/Dow Jones, TechCrunch, Bloomberg Law, CoinDesk).",
  },
  {
    id: "D2",
    title: "D2 EVIDENCE - the record cites checkable evidence",
    what: "The record must cite at least one external link (data, benchmark, incident, measurement) and anchor it with a date or a version, so the evidence stays checkable later.",
    why: "A decision that cites 'the data shows' without a link or a date cannot be re-checked. Evidence without a date rots silently; evidence without a link cannot be followed.",
    anchor:
      "Nvidia's 23/11/2026 announcement cited input from 'senior levels of the U.S. government' without naming the input or publishing it. Uncheckable evidence is the failure mode D2 catches.",
    threshold:
      "Pass: at least one http(s) link plus a date (YYYY-MM-DD) or a version (vX.Y) in the record. Fail: no link, or a link with no date or version.",
    source:
      "Honest limit: adrgate checks presence and format only. It does NOT verify that a cited link supports the claim.",
  },
  {
    id: "D3",
    title:
      "D3 DISSENT - alternatives considered and one rejected with a reason",
    what: "The record must list at least two considered options and reject at least one with a reason ('rejected', 'not chosen', 'ruled out', a downside or a trade-off). A lone 'Alternatives: none' fails with a clear message.",
    why: "A decision with no recorded alternative was never really decided; it was ratified. Dissent on the record is what lets a future reader reopen the decision honestly.",
    anchor:
      "The Nvidia reversal was announced as unanimous with no published dissent and no published alternative considered. Unanimity without a recorded alternative is not evidence of agreement.",
    threshold:
      "Pass: two or more options listed and at least one rejected with a reason. Fail: no options section, one option only, or options with no rejection reason.",
    source:
      "MADR 'Considered Options' / 'Decision Outcome' sections count as the options section.",
  },
  {
    id: "D4",
    title: "D4 REVIEW - a review date exists and is not stale",
    what: "The record must carry a review or expiry date (frontmatter 'review date' / 'expires', or a 'Review date:' line) that is on or after today. Undated records fail; past review dates fail as stale.",
    why: "Decisions expire. A record with no review date is treated as permanent by default, and permanent-by-default is how a five-day reversal becomes a surprise.",
    anchor:
      "The board's 18/11/2026 position and its 22/11/2026 vote were five days apart. A dated review would have forced the question 'what changed since the last review' into the open.",
    threshold:
      "Pass: review date present and not past. Default stale-after for undated decisions is 180 days (configurable in adrgate.config.json).",
    source: "Config key: staleAfterDays in adrgate.config.json.",
  },
  {
    id: "D5",
    title: "D5 IDENTITY - owner, status, and decision date present",
    what: "The record must name who decided (owner / author / deciders), the status (proposed, accepted, superseded, deprecated, rejected, draft), and the decision date (YYYY-MM-DD).",
    why: "A decision with no owner has no one to ask, no status has no state to act on, and no date has no history to audit. Identity is what turns a document into a record.",
    anchor:
      "Nvidia's announcement named the decision and its effective date but the public record of who decided what, and when the earlier position was set, had to be reconstructed from press coverage.",
    threshold:
      "Pass: all three present. Fail: any of owner, status, or decision date missing.",
    source:
      "Status values: proposed / accepted / superseded / deprecated / rejected / draft.",
  },
];

export function explainText(id?: string): string {
  if (!id) {
    const lines = ["adrgate rules (record-completeness only):", ""];
    for (const d of RULE_DOCS) {
      lines.push(`  ${d.id} - ${d.title.split(" - ")[1]}`);
    }
    lines.push("");
    lines.push(
      "adrgate never judges whether a decision was right. It checks only whether the record is governable.",
    );
    lines.push("Run `adrgate explain D1` (or D2..D5) for one rule in full.");
    return lines.join("\n");
  }
  const doc = RULE_DOCS.find((d) => d.id === id.toUpperCase());
  if (!doc) {
    throw new Error(
      `Unknown rule: ${id}. Known rules: ${RULE_DOCS.map((d) => d.id).join(", ")}.`,
    );
  }
  return [
    doc.title,
    "",
    `What it checks: ${doc.what}`,
    "",
    `Why it matters: ${doc.why}`,
    "",
    `Anchor: ${doc.anchor}`,
    "",
    `Threshold: ${doc.threshold}`,
    "",
    `Source: ${doc.source}`,
  ].join("\n");
}

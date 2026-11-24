import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_CONFIG } from "./types.js";

function isoPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function templateAdr(reviewDate: string, today: string): string {
  return `# 1. Use a governed decision record

Date: ${today}

Owner: YOUR NAME

Review date: ${reviewDate}

## Status

Proposed

## Context

We need to record a decision in a way that a future reader can reverse it
without guessing what changed. See the evidence below, dated 2026-11-23:

- Nvidia board timeline (23/11/2026): https://www.cnbc.com/2026/11/23/nvidia-reinstates-jensen-huang-as-ceo.html

## Decision

We will record every architecture decision as a Markdown ADR with reversal
conditions, cited evidence, considered options, a review date, and an owner.

## Considered Options

- Option A: Record decisions as ADRs with reversal conditions and review dates.
- Option B: Keep decisions in chat threads and meeting notes. Rejected: no owner, no review date, and no way to audit what changed.
- Option C: Keep decisions in a wiki page with no template. Rejected: no required fields, so reversal conditions and dissent are routinely missing.

## Reversal

We reverse this decision if a lighter record format is adopted by the team
and the ADR template is updated to match, or if ADRs stop being reviewed
within 30 days of their review date.

## Consequences

Every new ADR is audited by adrgate in CI. Records that miss reversal
conditions, evidence, dissent, a review date, or an owner fail the gate.
`;
}

export function runInit(dir: string): string[] {
  const target = dir || ".";
  mkdirSync(target, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const reviewDate = isoPlusDays(DEFAULT_CONFIG.staleAfterDays);
  const written: string[] = [];
  const configPath = join(target, "adrgate.config.json");
  if (!existsSync(configPath)) {
    writeFileSync(
      configPath,
      JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n",
      "utf8",
    );
    written.push(configPath);
  }
  const adrPath = join(target, "0001-use-a-governed-decision-record.md");
  if (!existsSync(adrPath)) {
    writeFileSync(adrPath, templateAdr(reviewDate, today), "utf8");
    written.push(adrPath);
  }
  return written;
}

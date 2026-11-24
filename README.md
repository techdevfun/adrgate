# adrgate

A zero-dependency CLI that audits decision records (ADRs / RFCs / decision
docs) for governability: can this decision be reversed without anyone being
able to say what changed?

```sh
# Install from source (no npm package yet)
git clone https://github.com/techdevfun/adrgate.git
cd adrgate
npm install
npm run build

# Audit the decision records in a directory
node dist/cli.js audit docs/adr

# Gate CI on them (exit 0 only when every record is GOVERNED)
node dist/cli.js check docs/adr
```

## Why this exists

On 18/11/2026 Nvidia's board said it had no intention of reinstating Jensen
Huang as CEO. On 22/11/2026 it voted unanimously to bring him back. On
23/11/2026 Nvidia announced the reversal, citing input from "senior levels
of the U.S. government". The market loved the outcome (shares up about 27%
in a day, per CoinDesk). The process is the problem: a board that can reverse
itself in five days without explaining what changed has a process problem,
not a personnel problem.

The same failure mode lives in every engineering org. ADRs and RFCs are
merged with no reversal conditions, no cited evidence, no recorded dissent
and no review date, so when the decision is reversed, nobody can say what
changed, what would reverse it, or who decided. And now agents draft ADRs
too: artefacts that look right but were never verified.

adrgate is the local check for that layer. It scores each record against
five explicit governability rules and gates CI on them.

## The five rules (D1-D5)

Each rule prints the exact evidence quote it used, so you can see *why* a
record passed or failed. Run `adrgate explain D1` (or D2-D5) for the full
text of one rule, including its Nvidia timeline anchor.

| Rule | What the record must have |
| ---- | ------------------------- |
| D1 REVERSAL | States the conditions under which the decision would be reversed ("we reverse if X"). A bare mention of "reverse" without a condition fails. |
| D2 EVIDENCE | Cites checkable evidence: a link to data, a benchmark, an incident, or a measurement, anchored with a date or a version. |
| D3 DISSENT | Lists the alternatives considered and rejects at least one with a reason. A lone "Alternatives: none" fails. |
| D4 REVIEW | Carries a review or expiry date that is not stale (default: review within 180 days, configurable). Undated records fail. |
| D5 IDENTITY | Names the owner, the status (proposed / accepted / superseded), and the decision date. |

Verdicts per record: **GOVERNED** (all required rules pass), **GAPS** (at
least half pass), **UNGOVERNED** (fewer than half pass), **UNKNOWN** (the
file is not a recognisable decision record; listed, never failed).

Formats parsed: MADR headings, generic ADR (Status / Context / Decision /
Consequences), RFC with frontmatter. Unknown formats get verdict UNKNOWN.

## Commands

```sh
adrgate init [dir]              # scaffold a governed record + adrgate.config.json
adrgate audit <path...>         # audit records; exit 0 GOVERNED, 1 GAPS/UNGOVERNED, 2 input error
adrgate check <path...>         # CI gate; same exit codes as audit
adrgate diff --baseline <file> <path...>   # exit 0 no regression, 1 regression, 2 input error
adrgate explain [D1..D5]        # what each rule checks and why
```

All commands accept `--json` (audit / check / diff). `audit` accepts
`--save-baseline <file>`; `check` accepts `--baseline <file>` to compare.
Config lives in `adrgate.config.json` (`staleAfterDays`, `requiredRules`).

## Real evidence: the adr-tools ADRs are 9/9 UNGOVERNED

The repo vendors nine real ADRs from the adr-tools project
(`npryce/adr-tools`, commit `b3279baf`, fetched 2026-11-24) under
`examples/real-corpus/` with a provenance README. Auditing them:

```sh
node dist/cli.js audit examples/real-corpus
# summary: 10 record(s) - 0 GOVERNED, 0 GAPS, 9 UNGOVERNED, 1 UNKNOWN
# (the 10th record is the corpus README, listed as UNKNOWN, never failed)
```

Only 3 of 45 rule checks pass. D1 reversal: 0/9. D2 evidence: 3/9. D3
dissent: 0/9. D4 review date: 0/9. D5 owner: 0/9 (all nine have a status
and a date, none names an owner). These are the canonical Nygard-format
records, and they predate every governability rule adrgate checks. That is
the point: even the reference implementation's own ADRs are ungoverned by
this bar, which is why the bar is worth automating.

Synthetic fixtures for tests live in `examples/fixture/` (seeded, labelled
synthetic): one GOVERNED, one GAPS, one UNGOVERNED, one UNKNOWN record.

## What adrgate is NOT

- It never judges whether a decision was **right**. It checks only whether
  the record is governable. That boundary is stated in `explain` and in
  every rule name ("record states...", not "decision is...").
- D2 is presence-only: a cited link may not support the claim. adrgate
  checks that evidence is cited and dated, not that it is true. A
  `--verify-links` HEAD check is on the roadmap, not in v0.1.0.
- It does not auto-fix existing records. Rewriting someone's decision
  record is a governance act, not a lint fix. `init` scaffolds a new
  governed record; findings print the exact missing section to add.
- It does not manage ADRs. `adr-tools` remains the standard for creating
  and listing ADRs; adrgate audits the records you already have.

## Honest limits

- Free-form ADRs in unusual prose can fail a heading heuristic. Format
  detection runs first, every finding carries its evidence quote, and
  unparseable files get verdict UNKNOWN instead of a false fail.
- Dates are read as written. A record that lies about its date passes D5;
  the tool audits the record, not the history.
- 100% local: no network in scan or check, no telemetry, no data leaves
  the repo. The audit trail is the git history plus the baseline file.

## Where rivals beat us

- **adr-tools** is the mature standard for *managing* ADRs (create, list,
  link, generate a table of contents). adrgate does not manage ADRs; it
  audits them. Use both.
- **log4brains** renders prettier ADR documentation sites. adrgate renders
  a terminal table, not a site.
- **Enterprise AI-governance SaaS** (Holistic AI, Credo AI) covers
  questionnaires, risk registers, and model inventories that a local CLI
  never will. adrgate is the repo-native check underneath those layers.
- **Review by hand** is still better at judging whether a decision was
  right. adrgate checks only whether the record is governable.

## Performance

Pure file parsing, no network. Audit of a 50-record corpus completes in
well under 2 seconds (measured during the build; see the build note for
the number on the build machine).

## Development

```sh
npm install
npm run build     # tsc --noEmit? No: tsc emits dist/ (gitignored)
npm test          # unit + e2e (node --test)
npm run test:live # live smoke (soft-skips on 403/429)
npm run lint      # eslint + prettier
npm run preflight # Rule 7: ASCII-only public content, no internal names
```

Requires Node 20+. Zero runtime dependencies.

## Roadmap

- P2: GitHub Action wrapper (a thin wrapper, not a second product).
- P2: `--verify-links` opt-in HEAD check for cited links (network-gated).
- P3: `--notify` webhook on gate failure; Confluence/Notion export.

## License

MIT. See [LICENSE](LICENSE).

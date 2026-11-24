# Real corpus - provenance

## Source

- Repository: `npryce/adr-tools` (the standard ADR CLI, 5,785 stars)
- Path in source repo: `doc/adr/*.md`
- Commit: `b3279baf9be2207d1a4f4bbd608fd0b591c72aee`
- Commit date: 2020-03-30 (last commit on master; repo last pushed 2024-04-25)
- Fetched: 2026-11-24 via `raw.githubusercontent.com` at the pinned commit
- Files: 9 ADRs (`0001` to `0009`), vendored verbatim, unmodified

## Licence note

The upstream repository carries no LICENSE file: the GitHub API reports
license `NOASSERTION` for `npryce/adr-tools` as of 2026-11-24. These nine
short decision records are vendored verbatim for audit demonstration,
with attribution to the upstream project and a link to the source. They
are NOT relicensed, and no claim is made over them. If the upstream
project adds a licence, this note will be updated to match it.

## What adrgate finds here (real audit, run 2026-11-24)

```sh
node dist/cli.js audit examples/real-corpus
# summary: 10 record(s) - 0 GOVERNED, 0 GAPS, 9 UNGOVERNED, 1 UNKNOWN
# (the 10th record is this README, listed as UNKNOWN, never failed)
```

Rule pass rates across the 9 records (3 of 45 rule checks pass):

- D1 reversal conditions: 0/9 pass. None of the nine records states when
  the decision would be reversed.
- D2 cited evidence: 3/9 pass (`0001`, `0004`, `0006` cite a link with a
  date in the record). The other six cite no link at all.
- D3 dissent: 0/9 pass. None has a Considered Options or Alternatives
  section.
- D4 review date: 0/9 pass. None carries a review date; the decisions are
  3,073 to 3,938 days old against a 180-day stale-after threshold.
- D5 owner + status + date: 0/9 pass. All nine have a status (Accepted)
  and a decision date, but none names an owner.

These are real findings about real records: the adr-tools ADRs are the
canonical Nygard-format records, and they predate every governability
rule adrgate checks. That is the point of the demo - even the reference
implementation's own ADRs are ungoverned by this bar, which is why the
bar is worth automating.

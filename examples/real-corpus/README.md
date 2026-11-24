# Real corpus - provenance

## Source

- Repository: `thomvaill/log4brains` (the ADR documentation-site tool,
  1,613 stars)
- Path in source repo: `docs/adr/*.md`
- Commit: `17e32021a8c5130386f17e921d4efa6da7709a66`
- Commit date: 2024-12-17 (repo last pushed 2024-12-17, default branch
  `develop`)
- Fetched: 2026-11-24 via `raw.githubusercontent.com` at the pinned commit
- Files: 9 ADRs, vendored verbatim, unmodified. The upstream `README.md`,
  `index.md`, and `template.md` in the same folder are NOT vendored: the
  template is not a decision record and the index is a listing, not a
  record. Two further upstream ADRs are NOT vendored either:
  `20200924-use-markdown-architectural-decision-records.md` and
  `20240926-transition-to-simplified-git-flow.md` contain non-ASCII
  typography (en dashes, curly apostrophes) that this repo's ASCII-only
  rule (Rule 7 preflight) excludes from public content. They are listed
  here, not silently dropped; every vendored file below is byte-identical
  to upstream at the pinned commit.

## Licence

The upstream repository is licensed under the Apache License 2.0,
verified live via the GitHub API on 2026-11-24 (`license.spdx_id` =
`Apache-2.0`). These nine decision records are reproduced verbatim
under that licence, with attribution to the upstream project and a link
to the source. They are NOT relicensed, and no claim is made over them.

This corpus replaces the adr-tools corpus vendored in the first build
(24/11/2026): that upstream repository carries no licence
(`NOASSERTION`), which left the vendored files in a licence grey zone.
The swap was made to remove the grey zone entirely; the licence risk is
also registered as R7 in the README risk register.

## What adrgate finds here (real audit, run 2026-11-24)

```sh
node dist/cli.js audit examples/real-corpus
# summary: 10 record(s) - 0 GOVERNED, 0 GAPS, 8 UNGOVERNED, 2 UNKNOWN
# (the 10th record is this README, listed as UNKNOWN, never failed;
#  the other UNKNOWN is the short 20200927 record, see below)
```

Rule pass rates across the 8 parsed records (6 of 40 rule checks pass):

- D1 reversal conditions: 0/8 pass. None of the eight records states when
  the decision would be reversed.
- D2 cited evidence: 6/8 pass. Six records cite a link with a date or
  a version in the record. The two that fail (`20201016`, `20201026`)
  cite no link at all.
- D3 dissent: 0/8 pass. None of the eight has a Considered Options
  section.
- D4 review date: 0/8 pass. None carries a review date; the decisions
  are dated 2020-09-25 to 2024-12-17, so 707 to 2,251 days old against a
  180-day stale-after threshold.
- D5 owner + status + date: 0/8 pass. None names an owner. The records
  carry `- Status: accepted` and `- Date:` bullet lines; the checker
  reads the date from those lines but does not recognise a bullet status
  line as a status section, so it reports status as missing too. That is
  a heading-heuristic limit of the checker, disclosed in the README
  Honest limits, not a claim that the records have no status.

The ninth record, `20200927-avoid-default-exports.md`, is a real
three-line record with no Context or Decision Outcome section, so the
format detector lists it as UNKNOWN (listed, never failed).

These are real findings about real records: the log4brains ADRs are
MADR-format records written between 2020 and 2024, and they predate
every governability rule adrgate checks. That is the point of the demo -
even a mature project's own ADRs are ungoverned by this bar, which is
why the bar is worth automating.

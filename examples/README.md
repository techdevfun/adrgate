# Examples

## Fixture corpus (synthetic, seeded provenance)

`examples/fixture/` is a synthetic corpus written for this repo on
2026-11-24. It is NOT real data. Use it for unit and end-to-end tests:

- `governed.md` - passes all 5 rules (D1-D5): reversal condition, cited
  evidence with a date, two rejected options, a future review date, and
  owner + status + decision date.
- `gaps.md` - passes D2, D3, D5; fails D1 (no reversal condition) and D4
  (no review date). Verdict: GAPS.
- `ungoverned.md` - passes D5 only. Verdict: UNGOVERNED.
- `unknown.md` - free-form notes with no ADR structure. Verdict: UNKNOWN
  (listed, never failed).

```sh
node dist/cli.js audit examples/fixture
# exit 1: 1 GOVERNED, 1 GAPS, 1 UNGOVERNED, 1 UNKNOWN
```

## Real corpus (public ADRs, vendored)

`examples/real-corpus/` holds 9 real ADRs from the adr-tools project
(`npryce/adr-tools`, commit b3279baf9be2207d1a4f4bbd608fd0b591c72aee,
fetched 2026-11-24). See its README.md for provenance. Audit it live:

```sh
node dist/cli.js audit examples/real-corpus
```

## Config

`adrgate.config.json` - a ready-to-copy config: stale-after 180 days and
all 5 rules required. Copy it to your project root (or run
`adrgate init` to generate one), then:

```sh
node dist/cli.js check docs/adr
```

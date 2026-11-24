# Contributing

adrgate is a small, zero-dependency CLI. Keep it that way.

## Rules for contributors

- Zero runtime dependencies. If a change needs a dependency, it does not
  ship in v0.1.x; open an issue instead.
- Every new rule or behaviour change needs a test in `test/` first.
  Run `npm test` (unit + e2e) and `npm run test:live` before opening a PR.
- All public content (README, code strings shown to users, docs, examples,
  demo transcript) must be 100% ASCII English with no em dash. Run
  `npm run preflight` to check.
- Never judge whether a decision was right. adrgate checks
  record-completeness only; keep that boundary in every rule name,
  message, and doc.
- No invented numbers. Any number in the README or in a rule message must
  come from a measured run or a cited source with a date.
- `dist/` is build output and is never committed.

## Development

```sh
npm install
npm run build
npm test
npm run lint
npm run preflight
```

#!/usr/bin/env bash
# Capture the demo transcript from the REAL CLI (no hand-edited output).
# The audit step runs on the REAL vendored corpus (log4brains ADRs,
# examples/real-corpus, provenance in its README.md). The check/diff
# steps run on the synthetic fixture corpus (examples/fixture, labelled
# synthetic). The baseline is produced by a real audit run in this script.
# The init step runs from inside the scratch dir with a relative path,
# so the transcript never contains the builder's absolute paths.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRATCH=/tmp/adrgate-demo
BIN="$SCRATCH/bin"
rm -rf "$SCRATCH"
mkdir -p "$BIN" "$ROOT/demo"
ln -sf "$ROOT/dist/cli.js" "$BIN/adrgate"
chmod +x "$ROOT/dist/cli.js"
export PATH="$BIN:$PATH"

OUT="$ROOT/demo/transcript.txt"
BASELINE="$SCRATCH/baseline.json"
cd "$ROOT"
{
  echo "# adrgate demo - real CLI output"
  echo "# (audit runs on the REAL vendored corpus: 9 ADRs from thomvaill/log4brains,"
  echo "#  commit 17e32021, Apache-2.0; check/diff run on the synthetic fixture corpus;"
  echo "#  the baseline below is produced by a real audit run)"
  echo ""
  echo "$ adrgate init demo-decisions"
  (cd "$SCRATCH" && adrgate init demo-decisions)
  echo ""
  echo "$ adrgate audit examples/real-corpus"
  adrgate audit examples/real-corpus || echo "exit: $?"
  echo ""
  echo "$ adrgate check examples/fixture"
  adrgate check examples/fixture || echo "exit: $?"
  echo ""
  echo "$ adrgate audit examples/fixture --save-baseline baseline.json > /dev/null"
  adrgate audit examples/fixture --save-baseline "$BASELINE" > /dev/null || echo "exit: $?"
  echo "(baseline receipt written, $(wc -c < "$BASELINE") bytes)"
  echo ""
  echo "$ adrgate diff --baseline baseline.json examples/fixture"
  adrgate diff --baseline "$BASELINE" examples/fixture || echo "exit: $?"
  echo ""
  echo "$ adrgate explain D1"
  adrgate explain D1
} > "$OUT" 2>&1

echo "transcript written: $OUT ($(wc -l < "$OUT") lines)"

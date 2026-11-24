#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import {
  auditPaths,
  diffAgainstBaseline,
  exitCodeFor,
  toBaseline,
} from "./audit.js";
import { loadConfig } from "./config.js";
import { explainText } from "./explain.js";
import { runInit } from "./init.js";
import { renderDiff, renderHuman } from "./report.js";
import { VERSION, type Baseline } from "./types.js";

function usage(): string {
  return [
    "adrgate 0.1.0 - audit decision records (ADRs / RFCs) for governability",
    "",
    "Usage:",
    "  adrgate init [dir]              scaffold a governed record + config",
    "  adrgate audit <path...>         audit records (exit 0/1/2)",
    "  adrgate check <path...>         CI gate (exit 0/1/2)",
    "  adrgate diff --baseline <file> <path...>   regressions since baseline",
    "  adrgate explain [D1..D5]        what each rule checks and why",
    "",
    "Options:",
    "  --json                machine-readable output (audit / check)",
    "  --config <file>       config file (default: adrgate.config.json)",
    "  --stale-after <days>  override the stale-after threshold",
    "  --save-baseline <file>  write a baseline JSON (audit)",
    "  --baseline <file>     compare against a baseline (check / diff)",
    "",
    "adrgate never judges whether a decision was right. It checks only",
    "whether the record is governable: reversal conditions, cited evidence,",
    "recorded dissent, a live review date, and owner + status + date.",
  ].join("\n");
}

interface Flags {
  json: boolean;
  config?: string;
  staleAfter?: number;
  saveBaseline?: string;
  baseline?: string;
  positional: string[];
}

function parseFlags(args: string[]): Flags {
  const flags: Flags = { json: false, positional: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--json") flags.json = true;
    else if (a === "--config") flags.config = args[++i];
    else if (a === "--stale-after") flags.staleAfter = Number(args[++i]);
    else if (a === "--save-baseline") flags.saveBaseline = args[++i];
    else if (a === "--baseline") flags.baseline = args[++i];
    else if (a.startsWith("--")) throw new Error(`Unknown option: ${a}`);
    else flags.positional.push(a);
  }
  return flags;
}

function loadBaseline(path: string): Baseline {
  const raw = JSON.parse(readFileSync(path, "utf8")) as Baseline;
  if (raw.version !== 1 || typeof raw.records !== "object") {
    throw new Error(`Not an adrgate baseline file: ${path}`);
  }
  return raw;
}

function main(): number {
  const argv = process.argv.slice(2);
  const command = argv[0];
  if (!command || command === "--help" || command === "-h") {
    console.log(usage());
    return 0;
  }
  if (command === "--version" || command === "-v") {
    console.log(`adrgate ${VERSION}`);
    return 0;
  }

  try {
    if (command === "init") {
      const dir = argv[1] ?? ".";
      const written = runInit(dir);
      if (written.length === 0) {
        console.log(
          `init: ${dir} already has adrgate.config.json and a template record. Nothing written.`,
        );
      } else {
        console.log("init: wrote:");
        for (const f of written) console.log(`  ${f}`);
        console.log(
          "Edit the owner, the evidence link, and the review date, then run: adrgate audit .",
        );
      }
      return 0;
    }

    if (command === "explain") {
      console.log(explainText(argv[1]));
      return 0;
    }

    if (command === "audit" || command === "check") {
      const flags = parseFlags(argv.slice(1));
      if (flags.positional.length === 0) {
        throw new Error(`Usage: adrgate ${command} <path...>`);
      }
      const config = loadConfig(flags.config);
      if (flags.staleAfter !== undefined) {
        if (!Number.isFinite(flags.staleAfter) || flags.staleAfter <= 0) {
          throw new Error("--stale-after must be a positive number of days.");
        }
        config.staleAfterDays = Math.floor(flags.staleAfter);
      }
      const report = auditPaths(flags.positional, config);
      if (flags.saveBaseline) {
        writeFileSync(
          flags.saveBaseline,
          JSON.stringify(toBaseline(report), null, 2) + "\n",
          "utf8",
        );
      }
      if (flags.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(renderHuman(report));
      }
      let code = exitCodeFor(report);
      if (flags.baseline) {
        const baseline = loadBaseline(flags.baseline);
        const diff = diffAgainstBaseline(report, baseline);
        console.log("");
        console.log(renderDiff(diff));
        if (diff.regressions.length > 0) code = 1;
      }
      return code;
    }

    if (command === "diff") {
      const flags = parseFlags(argv.slice(1));
      if (!flags.baseline) {
        throw new Error("Usage: adrgate diff --baseline <file> <path...>");
      }
      if (flags.positional.length === 0) {
        throw new Error("Usage: adrgate diff --baseline <file> <path...>");
      }
      const config = loadConfig(flags.config);
      const report = auditPaths(flags.positional, config);
      const baseline = loadBaseline(flags.baseline);
      const diff = diffAgainstBaseline(report, baseline);
      if (flags.json) {
        console.log(
          JSON.stringify(
            { ...diff, exitHint: diff.regressions.length > 0 ? 1 : 0 },
            null,
            2,
          ),
        );
      } else {
        console.log(renderDiff(diff));
      }
      return diff.regressions.length > 0 ? 1 : 0;
    }

    throw new Error(`Unknown command: ${command}\n\n${usage()}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`adrgate: error: ${msg}`);
    return 2;
  }
}

process.exit(main());

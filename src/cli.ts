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
    "",
    "Run `adrgate <command> --help` for per-command usage.",
  ].join("\n");
}

function usageFor(command: string): string {
  switch (command) {
    case "init":
      return [
        "adrgate init - scaffold a governed record + config",
        "",
        "Usage:",
        "  adrgate init [dir]",
        "",
        "Writes adrgate.config.json and",
        "0001-use-a-governed-decision-record.md into [dir]",
        "(default: the current directory).",
      ].join("\n");
    case "audit":
      return [
        "adrgate audit - audit records for governability",
        "",
        "Usage:",
        "  adrgate audit <path...> [--json] [--config <file>]",
        "      [--stale-after <days>] [--save-baseline <file>]",
        "      [--baseline <file>]",
        "",
        "Exit codes: 0 all GOVERNED, 1 GAPS or UNGOVERNED present,",
        "2 input error.",
      ].join("\n");
    case "check":
      return [
        "adrgate check - CI gate over decision records",
        "",
        "Usage:",
        "  adrgate check <path...> [--json] [--config <file>]",
        "      [--stale-after <days>] [--baseline <file>]",
        "",
        "Same exit codes as audit: 0 all GOVERNED,",
        "1 GAPS or UNGOVERNED present, 2 input error.",
      ].join("\n");
    case "diff":
      return [
        "adrgate diff - regressions since a baseline",
        "",
        "Usage:",
        "  adrgate diff --baseline <file> <path...> [--json]",
        "      [--config <file>]",
        "",
        "Exit codes: 0 no regressions, 1 regression found,",
        "2 input error.",
      ].join("\n");
    case "explain":
      return [
        "adrgate explain - what each rule checks and why",
        "",
        "Usage:",
        "  adrgate explain [D1..D5]",
        "",
        "With no rule id, lists all five rules. With D1..D5,",
        "prints that rule in full, with its Nvidia timeline anchor.",
      ].join("\n");
    default:
      return usage();
  }
}

function wantsHelp(args: string[]): boolean {
  return args.includes("--help") || args.includes("-h");
}

function wantsVersion(args: string[]): boolean {
  return args.includes("--version") || args.includes("-v");
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
      const rest = argv.slice(1);
      if (wantsHelp(rest)) {
        console.log(usageFor("init"));
        return 0;
      }
      if (wantsVersion(rest)) {
        console.log(`adrgate ${VERSION}`);
        return 0;
      }
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
      const rest = argv.slice(1);
      if (wantsHelp(rest)) {
        console.log(usageFor("explain"));
        return 0;
      }
      if (wantsVersion(rest)) {
        console.log(`adrgate ${VERSION}`);
        return 0;
      }
      console.log(explainText(argv[1]));
      return 0;
    }

    if (command === "audit" || command === "check") {
      const rest = argv.slice(1);
      if (wantsHelp(rest)) {
        console.log(usageFor(command));
        return 0;
      }
      if (wantsVersion(rest)) {
        console.log(`adrgate ${VERSION}`);
        return 0;
      }
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
      const rest = argv.slice(1);
      if (wantsHelp(rest)) {
        console.log(usageFor("diff"));
        return 0;
      }
      if (wantsVersion(rest)) {
        console.log(`adrgate ${VERSION}`);
        return 0;
      }
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

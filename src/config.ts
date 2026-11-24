import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALL_RULES,
  DEFAULT_CONFIG,
  type GateConfig,
  type RuleId,
} from "./types.js";

export function loadConfig(explicitPath?: string): GateConfig {
  const candidates = explicitPath
    ? [explicitPath]
    : ["adrgate.config.json", join(process.cwd(), "adrgate.config.json")];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const raw = JSON.parse(readFileSync(path, "utf8")) as Record<
        string,
        unknown
      >;
      const staleAfterDays =
        typeof raw["staleAfterDays"] === "number" && raw["staleAfterDays"] > 0
          ? Math.floor(raw["staleAfterDays"])
          : DEFAULT_CONFIG.staleAfterDays;
      const requiredRules = Array.isArray(raw["requiredRules"])
        ? (raw["requiredRules"].filter((r): r is RuleId =>
            ALL_RULES.includes(r as RuleId),
          ) as RuleId[])
        : DEFAULT_CONFIG.requiredRules;
      return {
        staleAfterDays,
        requiredRules: requiredRules.length > 0 ? requiredRules : ["D1"],
      };
    } catch {
      throw new Error(`Cannot parse config file: ${path}`);
    }
  }
  return { ...DEFAULT_CONFIG };
}

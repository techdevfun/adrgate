export type RuleId = "D1" | "D2" | "D3" | "D4" | "D5";
export type Verdict = "GOVERNED" | "GAPS" | "UNGOVERNED" | "UNKNOWN";
export type FormatKind = "MADR" | "GENERIC_ADR" | "RFC" | "UNKNOWN";

export interface RuleResult {
  id: RuleId;
  name: string;
  pass: boolean;
  evidence: string;
  detail: string;
}

export interface RecordAudit {
  file: string;
  format: FormatKind;
  verdict: Verdict;
  passed: number;
  required: number;
  rules: RuleResult[];
}

export interface AuditSummary {
  files: number;
  governed: number;
  gaps: number;
  ungoverned: number;
  unknown: number;
}

export interface AuditReport {
  tool: string;
  version: string;
  auditedAt: string;
  records: RecordAudit[];
  summary: AuditSummary;
}

export interface Baseline {
  version: 1;
  generatedAt: string;
  records: Record<string, { verdict: Verdict; failedRules: RuleId[] }>;
}

export interface DiffResult {
  regressions: {
    file: string;
    kind: string;
    detail: string;
  }[];
  fixed: { file: string; detail: string }[];
  added: string[];
  removed: string[];
}

export interface GateConfig {
  staleAfterDays: number;
  requiredRules: RuleId[];
}

export const ALL_RULES: RuleId[] = ["D1", "D2", "D3", "D4", "D5"];

export const DEFAULT_CONFIG: GateConfig = {
  staleAfterDays: 180,
  requiredRules: ["D1", "D2", "D3", "D4", "D5"],
};

export const VERSION = "0.1.0";

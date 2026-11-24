import type { FormatKind } from "./types.js";

export interface ParsedRecord {
  /** Raw file text. */
  text: string;
  /** Frontmatter key/value pairs (lower-cased keys), empty when absent. */
  frontmatter: Record<string, string>;
  /** Heading text (normalised) -> section body text. */
  sections: Map<string, string>;
  /** All ATX heading texts, normalised, in order. */
  headings: string[];
  /** External link URLs found in the text. */
  links: string[];
  /** Lines of the file, for evidence quotes. */
  lines: string[];
}

const ISO_DATE_RE = /\b(\d{4})-(\d{2})-(\d{2})\b/;

export function normaliseHeading(h: string): string {
  return h
    .replace(/^#+\s*/, "")
    .replace(/[*_`]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function parseFrontmatter(text: string): {
  frontmatter: Record<string, string>;
  body: string;
} {
  const frontmatter: Record<string, string> = {};
  if (!text.startsWith("---\n") && !text.startsWith("---\r\n")) {
    return { frontmatter, body: text };
  }
  const end = text.indexOf("\n---", 3);
  if (end === -1) return { frontmatter, body: text };
  const block = text.slice(4, end);
  for (const line of block.split("\n")) {
    const m = line.match(/^([A-Za-z][A-Za-z0-9 _-]*):\s*(.+?)\s*$/);
    if (m) frontmatter[m[1].trim().toLowerCase()] = m[2].trim();
  }
  return { frontmatter, body: text.slice(end + 4) };
}

export function parseRecord(text: string): ParsedRecord {
  const lines = text.split("\n");
  const { frontmatter, body } = parseFrontmatter(text);
  const sections = new Map<string, string>();
  const headings: string[] = [];
  let current: string | null = null;
  let currentLines: string[] = [];

  const flush = () => {
    if (current !== null) sections.set(current, currentLines.join("\n"));
  };

  for (const line of body.split("\n")) {
    const m = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (m) {
      flush();
      current = normaliseHeading(m[2]);
      headings.push(current);
      currentLines = [];
    } else if (current !== null) {
      currentLines.push(line);
    }
  }
  flush();

  const links: string[] = [];
  const linkRe = /\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g;
  let lm: RegExpExecArray | null;
  while ((lm = linkRe.exec(text)) !== null) links.push(lm[1]);
  const bareRe = /(?<![\w(])https?:\/\/[^\s)>\]]+/g;
  let bm: RegExpExecArray | null;
  while ((bm = bareRe.exec(text)) !== null) {
    if (!links.includes(bm[0])) links.push(bm[0]);
  }

  return { text, frontmatter, sections, headings, links, lines };
}

export function detectFormat(p: ParsedRecord): FormatKind {
  const has = (...names: string[]) => names.some((n) => p.headings.includes(n));
  if (
    has(
      "context and problem statement",
      "considered options",
      "decision outcome",
    )
  ) {
    return "MADR";
  }
  if (has("status") && (has("context") || has("decision")))
    return "GENERIC_ADR";
  const fm = p.frontmatter;
  if (fm["status"] && (fm["author"] || fm["owner"] || fm["date"])) {
    return "RFC";
  }
  // A lone Status section plus a Date line is still a recognisable ADR.
  if (has("status") && ISO_DATE_RE.test(p.text)) return "GENERIC_ADR";
  return "UNKNOWN";
}

/** First ISO date found in the given text, as a Date, or null. */
export function findIsoDate(text: string): Date | null {
  const m = text.match(ISO_DATE_RE);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** All ISO dates found in the given text. */
export function findIsoDates(text: string): Date[] {
  const out: Date[] = [];
  const re = new RegExp(ISO_DATE_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) out.push(d);
  }
  return out;
}

/** First line matching `re` (trimmed, capped at 160 chars), or null. */
export function firstMatchingLine(lines: string[], re: RegExp): string | null {
  for (const line of lines) {
    if (re.test(line)) return line.trim().slice(0, 160);
  }
  return null;
}

/** Section body for the first heading whose normalised text contains `frag`. */
export function sectionContaining(
  p: ParsedRecord,
  frag: string,
): string | null {
  for (const [h, body] of p.sections) {
    if (h.includes(frag)) return body;
  }
  return null;
}

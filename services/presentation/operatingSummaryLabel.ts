import type { MessageKey } from "../../i18n/catalog";

/**
 * Known TodaySummary / Daily Report `operatingSummary` strings from
 * `buildTodaySummary` in miseDomain. Only this exact English template is
 * localized; anything else is shown as-is so the UI never invents facts.
 */

/** Exact English template currently emitted by `buildTodaySummary`. */
export const OPERATING_SUMMARY_ATTENTION_RE =
  /^Mise found (\d+) items? that may need attention before tomorrow\.$/;

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

export type ParsedOperatingSummary =
  | { kind: "attention"; count: number }
  | { kind: "unknown" };

export function parseOperatingSummary(summary: string): ParsedOperatingSummary {
  const match = OPERATING_SUMMARY_ATTENTION_RE.exec(summary.trim());
  if (!match) return { kind: "unknown" };
  const count = Number(match[1]);
  if (!Number.isFinite(count) || count < 0 || !Number.isInteger(count)) {
    return { kind: "unknown" };
  }
  return { kind: "attention", count };
}

export function operatingSummaryLabelKey(count: number): MessageKey {
  return count === 1
    ? "dailyReport.operatingSummary.attention.one"
    : "dailyReport.operatingSummary.attention.other";
}

export function presentOperatingSummaryLabel(summary: string, t: Translate): string {
  const parsed = parseOperatingSummary(summary);
  if (parsed.kind === "attention") {
    return t(operatingSummaryLabelKey(parsed.count), { count: parsed.count });
  }
  const trimmed = summary.trim();
  return trimmed || "—";
}

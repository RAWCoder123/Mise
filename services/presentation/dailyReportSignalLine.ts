import type { MessageKey } from "../../i18n/catalog";
import type { DailyOpsSignalType } from "../domain/dailyOpsReport";

/**
 * Known empty closeout signal lines from `pickSignalLine` in dailyOpsReport.
 * Only the exact `No {type} signal for closeout.` template is localized;
 * insight-derived lines pass through unchanged.
 */

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

const EMPTY_SIGNAL_RE = /^No (waste|prep|inventory|sales|cost) signal for closeout\.$/;

const SIGNAL_TYPES = new Set<DailyOpsSignalType>([
  "waste",
  "prep",
  "inventory",
  "sales",
  "cost"
]);

export function parseEmptySignalLine(
  line: string
): { kind: "empty"; type: DailyOpsSignalType } | { kind: "unknown" } {
  const match = EMPTY_SIGNAL_RE.exec(line.trim());
  if (!match) return { kind: "unknown" };
  const type = match[1] as DailyOpsSignalType;
  if (!SIGNAL_TYPES.has(type)) return { kind: "unknown" };
  return { kind: "empty", type };
}

export function emptySignalLineKey(type: DailyOpsSignalType): MessageKey {
  return `dailyReport.signal.empty.${type}` as MessageKey;
}

export function presentDailyReportSignalLine(line: string, t: Translate): string {
  const parsed = parseEmptySignalLine(line);
  if (parsed.kind === "empty") {
    return t(emptySignalLineKey(parsed.type));
  }
  const trimmed = line.trim();
  return trimmed || "—";
}

import type { MessageKey } from "../../i18n/catalog";

/**
 * Known TodaySummary credibility label / next-step strings from
 * `buildCredibilitySummary` in miseDomain. Only these exact values are
 * localized; anything else is shown as-is so the UI never invents facts.
 */

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

const KNOWN_LABELS = {
  "Automation credibility high": "dailyReport.learning.credibility.high",
  "Credibility building": "dailyReport.learning.credibility.building",
  "More operator evidence needed": "dailyReport.learning.credibility.needsEvidence"
} as const satisfies Record<string, MessageKey>;

const KNOWN_NEXT_STEPS = {
  "Add missing recipe baselines before trusting automated ordering.":
    "dailyReport.learning.nextStep.addRecipes",
  "Approve or adjust the supplier queue so Mise learns your ordering judgment.":
    "dailyReport.learning.nextStep.approveOrders",
  "Keep updating counts after service so Mise can sharpen reorder timing.":
    "dailyReport.learning.nextStep.updateCounts"
} as const satisfies Record<string, MessageKey>;

export function credibilityLabelKey(label: string): MessageKey | null {
  if (Object.prototype.hasOwnProperty.call(KNOWN_LABELS, label)) {
    return KNOWN_LABELS[label as keyof typeof KNOWN_LABELS];
  }
  return null;
}

export function credibilityNextStepKey(nextStep: string): MessageKey | null {
  if (Object.prototype.hasOwnProperty.call(KNOWN_NEXT_STEPS, nextStep)) {
    return KNOWN_NEXT_STEPS[nextStep as keyof typeof KNOWN_NEXT_STEPS];
  }
  return null;
}

export function presentCredibilityLabel(label: string, t: Translate): string {
  const key = credibilityLabelKey(label);
  if (key) return t(key);
  const trimmed = label.trim();
  return trimmed || "—";
}

export function presentCredibilityNextStep(nextStep: string, t: Translate): string {
  const key = credibilityNextStepKey(nextStep);
  if (key) return t(key);
  const trimmed = nextStep.trim();
  return trimmed || "—";
}

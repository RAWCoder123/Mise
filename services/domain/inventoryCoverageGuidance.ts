/**
 * Translates observed average daily usage into days-of-cover implications for
 * par and reorder settings. Does not invent lead times, MOQs, or delivery
 * schedules — only the restaurant's measured usage rate.
 */

export const COVERAGE_TARGET_PAR_DAYS = 3;
export const COVERAGE_TARGET_REORDER_DAYS = 1.5;
export const COVERAGE_HIGH_PAR_DAYS = 8;
export const COVERAGE_TIGHT_REORDER_DAYS = 1;
export const COVERAGE_LOW_PAR_DAYS = 1.5;

export type InventoryCoverageGuidanceStatus =
  | "learning"
  | "misconfigured"
  | "tight_reorder"
  | "low_par"
  | "high_par"
  | "aligned";

export interface InventoryCoverageGuidance {
  status: InventoryCoverageGuidanceStatus;
  averageDailyUsage: number;
  parDays: number | null;
  reorderDays: number | null;
  targetParDays: number;
  targetReorderDays: number;
  suggestedPar: number | null;
  suggestedReorder: number | null;
  suggestionsDiffer: boolean;
}

export function buildInventoryCoverageGuidance(input: {
  averageDailyUsage: number;
  parLevel: number;
  reorderThreshold: number;
}): InventoryCoverageGuidance {
  const averageDailyUsage = finiteNonNegative(input.averageDailyUsage);
  const parLevel = finiteNonNegative(input.parLevel);
  const reorderThreshold = finiteNonNegative(input.reorderThreshold);

  if (averageDailyUsage <= 0) {
    return {
      status: "learning",
      averageDailyUsage: 0,
      parDays: null,
      reorderDays: null,
      targetParDays: COVERAGE_TARGET_PAR_DAYS,
      targetReorderDays: COVERAGE_TARGET_REORDER_DAYS,
      suggestedPar: null,
      suggestedReorder: null,
      suggestionsDiffer: false
    };
  }

  const parDays = roundDays(parLevel / averageDailyUsage);
  const reorderDays = roundDays(reorderThreshold / averageDailyUsage);
  const suggestedPar = roundQuantity(averageDailyUsage * COVERAGE_TARGET_PAR_DAYS);
  let suggestedReorder = roundQuantity(averageDailyUsage * COVERAGE_TARGET_REORDER_DAYS);
  if (suggestedReorder >= suggestedPar) {
    suggestedReorder = roundQuantity(Math.max(0, suggestedPar * 0.5));
  }

  const status = resolveStatus({
    parLevel,
    reorderThreshold,
    parDays,
    reorderDays
  });

  const suggestionsDiffer =
    status !== "misconfigured" &&
    (differs(parLevel, suggestedPar) || differs(reorderThreshold, suggestedReorder));

  return {
    status,
    averageDailyUsage,
    parDays,
    reorderDays,
    targetParDays: COVERAGE_TARGET_PAR_DAYS,
    targetReorderDays: COVERAGE_TARGET_REORDER_DAYS,
    suggestedPar,
    suggestedReorder,
    suggestionsDiffer
  };
}

function resolveStatus(input: {
  parLevel: number;
  reorderThreshold: number;
  parDays: number;
  reorderDays: number;
}): InventoryCoverageGuidanceStatus {
  if (input.reorderThreshold >= input.parLevel && input.parLevel > 0) {
    return "misconfigured";
  }
  if (input.parLevel > 0 && input.reorderThreshold > 0 && input.reorderDays < COVERAGE_TIGHT_REORDER_DAYS) {
    return "tight_reorder";
  }
  if (input.parLevel > 0 && input.parDays < COVERAGE_LOW_PAR_DAYS) {
    return "low_par";
  }
  if (input.parDays >= COVERAGE_HIGH_PAR_DAYS) {
    return "high_par";
  }
  return "aligned";
}

function differs(current: number, suggested: number) {
  const delta = Math.abs(current - suggested);
  if (delta < 0.05) return false;
  const relative = current > 0 ? delta / current : 1;
  return relative >= 0.05 || delta >= 0.5;
}

function finiteNonNegative(value: number) {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

function roundDays(value: number) {
  return Math.round(value * 10) / 10;
}

function roundQuantity(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value < 1) return Math.round(value * 10) / 10;
  if (value < 10) return Math.round(value * 2) / 2;
  return Math.round(value);
}

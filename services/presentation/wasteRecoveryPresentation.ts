import type { MessageKey } from "../../i18n/catalog";
import type { WasteAnalysisAction } from "../domain/wasteAnalysis";

export type WasteRecoveryHref = "/inventory" | `/inventory/${string}`;

export type WasteRecoveryLabelKey =
  | "waste.action.start_logging"
  | "waste.action.review_repeat_item"
  | "waste.action.complete_cost_setup"
  | "waste.action.keep_logging";

export interface WasteRecoveryAction {
  href: WasteRecoveryHref;
  labelKey: WasteRecoveryLabelKey;
  accessibilityLabelKey: WasteRecoveryLabelKey;
  /** Stable reason used for tests; never shown to operators. */
  reason: WasteAnalysisAction;
}

type WasteRecoveryInput = {
  recommendedAction: WasteAnalysisAction;
  primaryItemId: string | null;
};

/**
 * Maps waste analysis recommendedAction to an existing operator route.
 * Presentation-only: does not invent item IDs or change ledger authority.
 */
export function presentWasteRecoveryAction(
  analysis: WasteRecoveryInput
): WasteRecoveryAction {
  const itemHref = inventoryItemHref(analysis.primaryItemId);

  switch (analysis.recommendedAction) {
    case "review_repeat_item":
      return {
        href: itemHref ?? "/inventory",
        labelKey: "waste.action.review_repeat_item",
        accessibilityLabelKey: "waste.action.review_repeat_item",
        reason: "review_repeat_item"
      };
    case "complete_cost_setup":
      return {
        href: itemHref ?? "/inventory",
        labelKey: "waste.action.complete_cost_setup",
        accessibilityLabelKey: "waste.action.complete_cost_setup",
        reason: "complete_cost_setup"
      };
    case "keep_logging":
      return {
        href: "/inventory",
        labelKey: "waste.action.keep_logging",
        accessibilityLabelKey: "waste.action.keep_logging",
        reason: "keep_logging"
      };
    case "start_logging":
    default:
      return {
        href: "/inventory",
        labelKey: "waste.action.start_logging",
        accessibilityLabelKey: "waste.action.start_logging",
        reason: "start_logging"
      };
  }
}

export function wasteRecoveryLabelKey(
  action: WasteAnalysisAction
): MessageKey {
  return presentWasteRecoveryAction({
    recommendedAction: action,
    primaryItemId: null
  }).labelKey;
}

function inventoryItemHref(primaryItemId: string | null): `/inventory/${string}` | null {
  const id = typeof primaryItemId === "string" ? primaryItemId.trim() : "";
  if (!id) return null;
  return `/inventory/${encodeURIComponent(id)}`;
}

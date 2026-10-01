import type { MessageKey, MessageValues } from "../../i18n/catalog";
import {
  type InventoryCoverageGuidance,
  type InventoryCoverageGuidanceStatus
} from "../domain/inventoryCoverageGuidance";

type Translate = (key: MessageKey, values?: MessageValues) => string;
type FormatNumber = (value: number, options?: Intl.NumberFormatOptions) => string;

export interface PresentedInventoryCoverageGuidance {
  status: InventoryCoverageGuidanceStatus;
  title: string;
  body: string;
  daysSummary: string | null;
  suggestionSummary: string | null;
  applyLabel: string | null;
  showApply: boolean;
}

export function presentInventoryCoverageGuidance(
  t: Translate,
  formatNumber: FormatNumber,
  guidance: InventoryCoverageGuidance,
  unit: string
): PresentedInventoryCoverageGuidance {
  const days = (value: number) => formatNumber(value, { maximumFractionDigits: 1 });
  const quantity = (value: number) => formatNumber(value, { maximumFractionDigits: 1 });

  if (guidance.status === "learning") {
    return {
      status: guidance.status,
      title: t("inventory.coverage.learning.title"),
      body: t("inventory.coverage.learning.body"),
      daysSummary: null,
      suggestionSummary: null,
      applyLabel: null,
      showApply: false
    };
  }

  const daysSummary = t("inventory.coverage.daysSummary", {
    parDays: days(guidance.parDays ?? 0),
    reorderDays: days(guidance.reorderDays ?? 0)
  });

  const suggestionSummary =
    guidance.suggestionsDiffer &&
    guidance.suggestedPar !== null &&
    guidance.suggestedReorder !== null
      ? t("inventory.coverage.suggestionSummary", {
          parDays: days(guidance.targetParDays),
          reorderDays: days(guidance.targetReorderDays),
          par: quantity(guidance.suggestedPar),
          reorder: quantity(guidance.suggestedReorder),
          unit
        })
      : null;

  return {
    status: guidance.status,
    title: t(statusTitleKey(guidance.status)),
    body: t(statusBodyKey(guidance.status)),
    daysSummary,
    suggestionSummary,
    applyLabel: suggestionSummary ? t("inventory.coverage.applySuggestion") : null,
    showApply: Boolean(suggestionSummary)
  };
}

function statusTitleKey(status: Exclude<InventoryCoverageGuidanceStatus, "learning">): MessageKey {
  return `inventory.coverage.${status}.title` as MessageKey;
}

function statusBodyKey(status: Exclude<InventoryCoverageGuidanceStatus, "learning">): MessageKey {
  return `inventory.coverage.${status}.body` as MessageKey;
}

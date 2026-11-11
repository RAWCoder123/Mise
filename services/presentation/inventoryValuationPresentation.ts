import type { MessageKey } from "../../i18n/catalog";
import type { InventoryOnHandValuation } from "../domain/inventoryValuation";

type Translate = (
  key: MessageKey,
  values?: Readonly<Record<string, string | number>>
) => string;

/**
 * Operator-facing on-hand valuation copy. Never invents a currency total when
 * no priced items exist; incomplete cost setup stays visible.
 */
export function presentInventoryOnHandValuationLine(input: {
  valuation: InventoryOnHandValuation;
  formatCurrency: (value: number) => string;
  formatNumber: (value: number) => string;
  t: Translate;
}): string | null {
  const { valuation, formatCurrency, formatNumber, t } = input;
  if (valuation.itemCount === 0) return null;

  if (valuation.valuedOnHand === null) {
    return t("inventory.health.valuation.missingCosts");
  }

  const amount = formatCurrency(valuation.valuedOnHand);
  if (valuation.costComplete) {
    return t("inventory.health.valuation.complete", { amount });
  }

  return t(
    valuation.unpricedItemCount === 1
      ? "inventory.health.valuation.incomplete.one"
      : "inventory.health.valuation.incomplete.other",
    {
      amount,
      count: formatNumber(valuation.unpricedItemCount)
    }
  );
}

/** Appends valuation to an existing health body without replacing risk copy. */
export function presentInventoryHealthBodyWithValuation(input: {
  riskBody: string;
  valuationLine: string | null;
}): string {
  const risk = input.riskBody.trim();
  const valuation = input.valuationLine?.trim() ?? "";
  if (!valuation) return risk;
  if (!risk) return valuation;
  return `${risk} ${valuation}`;
}

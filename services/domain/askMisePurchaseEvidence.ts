/**
 * Deterministic invoice/purchase-line facts for Ask Mise.
 *
 * Grounds spend answers on MISE-004C `list_purchase_line_net_by_item` groups.
 * Never invents invoice totals from estimated order costs, recommendations, or
 * POS sales. Unmatched credits stay visible rather than silently netted away.
 */

import type { PurchaseLineNetByItem } from "./purchaseLines";

export interface AskMisePurchaseEvidenceItem {
  /** Normalized invoice wording key, or null when the ledger could not verify one. */
  normalizedItemKey: string | null;
  currency: string;
  netExtendedPrice: number;
  unmatchedCredit: boolean;
  purchaseLineCount: number;
  creditLineCount: number;
}

export interface AskMisePurchaseEvidence {
  /** Distinct net groups returned by the ledger (current lines only). */
  groupCount: number;
  /** Groups that carry a numeric net extended price and a currency. */
  pricedGroupCount: number;
  unmatchedCreditCount: number;
  /** True when priced groups span more than one currency code. */
  multiCurrency: boolean;
  /**
   * Restaurant-wide net invoice spend when every priced group shares one
   * currency. Null when there is no priced evidence or currencies disagree.
   */
  netSpend: number | null;
  currency: string | null;
  /** Highest absolute net-spend item groups, capped for operator answers. */
  topItems: AskMisePurchaseEvidenceItem[];
}

const TOP_ITEM_LIMIT = 3;

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Collapse purchase-line nets into bounded Ask Mise evidence. Groups without a
 * currency or net extended price are counted but never contribute invented money.
 */
export function buildAskMisePurchaseEvidence(
  nets: readonly PurchaseLineNetByItem[]
): AskMisePurchaseEvidence {
  const unmatchedCreditCount = nets.reduce(
    (count, group) => count + (group.unmatchedCredit ? 1 : 0),
    0
  );

  const priced = nets.filter(
    (group): group is PurchaseLineNetByItem & { netExtendedPrice: number; currency: string } =>
      isFiniteNumber(group.netExtendedPrice) &&
      typeof group.currency === "string" &&
      group.currency.trim().length > 0
  );

  const currencies = [...new Set(priced.map((group) => group.currency.trim().toUpperCase()))];
  const multiCurrency = currencies.length > 1;
  const currency = currencies.length === 1 ? currencies[0]! : null;
  const netSpend =
    currency === null
      ? null
      : priced.reduce((sum, group) => sum + group.netExtendedPrice, 0);

  const topItems = [...priced]
    .sort((left, right) => Math.abs(right.netExtendedPrice) - Math.abs(left.netExtendedPrice))
    .slice(0, TOP_ITEM_LIMIT)
    .map((group) => ({
      normalizedItemKey: group.normalizedItemKey,
      currency: group.currency.trim().toUpperCase(),
      netExtendedPrice: group.netExtendedPrice,
      unmatchedCredit: group.unmatchedCredit,
      purchaseLineCount: group.purchaseLineCount,
      creditLineCount: group.creditLineCount
    }));

  return {
    groupCount: nets.length,
    pricedGroupCount: priced.length,
    unmatchedCreditCount,
    multiCurrency,
    netSpend,
    currency,
    topItems
  };
}

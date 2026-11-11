import type { InventoryItem, PurchaseRecommendation, SupplierOrder } from "../../types/mise";
import { toDateKeyInTimeZone } from "../../utils/format";
import type { PurchaseLine } from "./purchaseLines";
import { markCurrentPurchaseLines } from "./purchaseLines";

export type SupplierSpendTrendBasis = "invoice_lines" | "estimated_orders";

export interface SupplierSpendTrendPoint {
  date: string;
  spend: number;
}

export interface SupplierSpendTrendOptions {
  limit?: number;
  timeZone?: string;
  /** Restaurant settlement currency; invoice lines in other currencies are excluded. */
  currency?: string | null;
}

export interface SupplierSpendTrend {
  basis: SupplierSpendTrendBasis;
  points: SupplierSpendTrendPoint[];
}

function pointLimit(options: SupplierSpendTrendOptions) {
  return typeof options.limit === "number" && Number.isFinite(options.limit)
    ? Math.max(1, Math.floor(options.limit))
    : 6;
}

function roundSpend(spend: number) {
  return Math.round(spend * 100) / 100;
}

function finalizeTrendPoints(
  totalsByDate: Map<string, number>,
  limit: number
): SupplierSpendTrendPoint[] {
  return [...totalsByDate.entries()]
    .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
    .slice(-limit)
    .map(([date, spend]) => ({
      date,
      spend: roundSpend(spend)
    }));
}

/**
 * Estimated spend per service date for sent/completed supplier orders,
 * priced from ordered recommendation quantities times the linked inventory
 * item's estimated unit cost. Orders whose line items cannot be priced
 * contribute nothing rather than inventing totals.
 */
export function buildSupplierSpendTrend(
  restaurantId: string,
  orders: readonly SupplierOrder[],
  recommendations: readonly PurchaseRecommendation[],
  inventoryItems: readonly InventoryItem[],
  options: SupplierSpendTrendOptions = {}
): SupplierSpendTrendPoint[] {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) return [];

  const limit = pointLimit(options);
  const timeZone = options.timeZone ?? "UTC";

  const unitCostByItemId = new Map<string, number>();
  inventoryItems.forEach((item) => {
    if (
      item.restaurant_id === normalizedRestaurantId &&
      Number.isFinite(item.estimated_unit_cost) &&
      item.estimated_unit_cost >= 0
    ) {
      unitCostByItemId.set(item.id, item.estimated_unit_cost);
    }
  });

  const spendByOrderId = new Map<string, number>();
  recommendations.forEach((recommendation) => {
    if (
      recommendation.restaurant_id !== normalizedRestaurantId ||
      recommendation.status !== "ordered" ||
      !recommendation.supplier_order_id ||
      !Number.isFinite(recommendation.recommended_quantity) ||
      recommendation.recommended_quantity <= 0
    ) {
      return;
    }
    const unitCost = unitCostByItemId.get(recommendation.inventory_item_id);
    if (unitCost === undefined) return;
    spendByOrderId.set(
      recommendation.supplier_order_id,
      (spendByOrderId.get(recommendation.supplier_order_id) ?? 0) +
        recommendation.recommended_quantity * unitCost
    );
  });

  const totalsByDate = new Map<string, number>();
  orders.forEach((order) => {
    if (
      order.restaurant_id !== normalizedRestaurantId ||
      (order.status !== "sent" && order.status !== "completed")
    ) {
      return;
    }
    const spend = spendByOrderId.get(order.id);
    if (spend === undefined || spend <= 0) return;
    const created = new Date(order.created_at);
    if (Number.isNaN(created.getTime())) return;
    const date = toDateKeyInTimeZone(created, timeZone);
    totalsByDate.set(date, (totalsByDate.get(date) ?? 0) + spend);
  });

  return finalizeTrendPoints(totalsByDate, limit);
}

function normalizeCurrency(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed === "" ? null : trimmed;
}

/**
 * Factual spend per invoice transaction date from current MISE-004C purchase
 * lines. Uses signed extended prices so credits net against purchases. Lines
 * without a signed amount, superseded history rows, foreign tenants, and
 * mismatched currencies contribute nothing.
 */
export function buildInvoiceSupplierSpendTrend(
  restaurantId: string,
  purchaseLines: readonly PurchaseLine[],
  options: SupplierSpendTrendOptions = {}
): SupplierSpendTrendPoint[] {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) return [];

  const limit = pointLimit(options);
  const restaurantCurrency = normalizeCurrency(options.currency);

  const currentLines = markCurrentPurchaseLines([...purchaseLines]).filter((line) => {
    if (!line.current) return false;
    if (line.restaurantId !== normalizedRestaurantId) return false;
    if (line.signedExtendedPrice === null || !Number.isFinite(line.signedExtendedPrice)) return false;
    return true;
  });

  if (restaurantCurrency === null) {
    const explicitCurrencies = new Set(
      currentLines
        .map((line) => normalizeCurrency(line.currency))
        .filter((currency): currency is string => currency !== null)
    );
    // Never sum USD and EUR into one chart when the restaurant currency is unknown.
    if (explicitCurrencies.size > 1) return [];
  }

  const totalsByDate = new Map<string, number>();
  for (const line of currentLines) {
    const lineCurrency = normalizeCurrency(line.currency);
    if (
      restaurantCurrency !== null &&
      lineCurrency !== null &&
      lineCurrency !== restaurantCurrency
    ) {
      continue;
    }

    const date = line.transactionDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) continue;
    totalsByDate.set(date, (totalsByDate.get(date) ?? 0) + line.signedExtendedPrice!);
  }

  return finalizeTrendPoints(totalsByDate, limit);
}

/**
 * Prefer recorded invoice spend when it can draw a trend (≥2 dated buckets).
 * Otherwise fall back to estimated sent-order spend so the Orders chart still
 * has a truthful estimated series when no ledger evidence exists yet.
 */
export function resolveSupplierSpendTrend(input: {
  restaurantId: string;
  purchaseLines: readonly PurchaseLine[];
  orders: readonly SupplierOrder[];
  recommendations: readonly PurchaseRecommendation[];
  inventoryItems: readonly InventoryItem[];
  options?: SupplierSpendTrendOptions;
}): SupplierSpendTrend {
  const options = input.options ?? {};
  const invoicePoints = buildInvoiceSupplierSpendTrend(
    input.restaurantId,
    input.purchaseLines,
    options
  );
  if (invoicePoints.length >= 2) {
    return { basis: "invoice_lines", points: invoicePoints };
  }

  return {
    basis: "estimated_orders",
    points: buildSupplierSpendTrend(
      input.restaurantId,
      input.orders,
      input.recommendations,
      input.inventoryItems,
      options
    )
  };
}

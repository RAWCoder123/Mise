import type { SupplierOrder } from "../../types/mise";
import { toDateKeyInTimeZone } from "../../utils/format";

export type SupplierDeliveryStatus =
  | "unverified"
  | "partially_received"
  | "received"
  | "discrepancy"
  | "failed";

export interface SupplierDeliveryRecord {
  id: string;
  restaurant_id: string;
  supplier_order_id: string;
  status: SupplierDeliveryStatus;
  received_at: string;
  notes: string | null;
  created_at: string;
}

export interface SupplierDeliveryItemRecord {
  id: string;
  restaurant_id: string;
  delivery_id: string;
  inventory_item_id: string;
  ordered_quantity: number | null;
  received_quantity: number;
  damaged_quantity: number;
  missing_quantity: number;
  canonical_unit: string;
  discrepancy_reason?: string | null;
}

export interface SupplierDeliveryHistory {
  deliveries: SupplierDeliveryRecord[];
  items: SupplierDeliveryItemRecord[];
}

export type SupplierReliabilityStatus = "reliable" | "watch" | "at_risk" | "insufficient";

export type SupplierReliabilityReason =
  | "limited_history"
  | "late_deliveries"
  | "delivery_discrepancies"
  | "underfilled_lines"
  | "unverified_deliveries"
  | "matched_history";

export interface SupplierReliabilityEntry {
  supplierName: string;
  status: SupplierReliabilityStatus;
  deliveryCount: number;
  onTimeCount: number;
  measurableDeliveryCount: number;
  issueDeliveryCount: number;
  unverifiedDeliveryCount: number;
  discrepancyLineCount: number;
  onTimeRate: number | null;
  matchedDeliveryRate: number;
  fulfillmentRate: number | null;
  reasons: SupplierReliabilityReason[];
  lastDeliveryAt: string;
  relatedOrderIds: string[];
}

export interface SupplierReliabilitySummary {
  totalDeliveries: number;
  supplierCount: number;
  attentionSupplierCount: number;
  overallOnTimeRate: number | null;
  overallMatchedDeliveryRate: number | null;
  suppliers: SupplierReliabilityEntry[];
}

export type SupplierDeliveryTiming = "on_time" | "late" | "unmeasured";

export interface SupplierOrderDeliveryEvidence {
  deliveryId: string;
  status: SupplierDeliveryStatus;
  receivedAt: string;
  timing: SupplierDeliveryTiming;
  lineCount: number;
  discrepancyLineCount: number;
  missingLineCount: number;
  damagedLineCount: number;
  notes: string | null;
}

interface SupplierAccumulator {
  supplierName: string;
  deliveries: SupplierDeliveryRecord[];
  orders: SupplierOrder[];
  items: SupplierDeliveryItemRecord[];
}

const ISSUE_STATUSES = new Set<SupplierDeliveryStatus>([
  "partially_received",
  "discrepancy",
  "failed"
]);

/**
 * Turns tenant-scoped supplier receipts into a deterministic performance
 * summary. A promise is measured only when the order has a delivery date, and
 * a clean outcome is counted only after a receipt is explicitly verified.
 */
export function buildSupplierReliabilitySummary(input: {
  restaurantId: string;
  restaurantTimeZone: string;
  orders: readonly SupplierOrder[];
  deliveries: readonly SupplierDeliveryRecord[];
  items: readonly SupplierDeliveryItemRecord[];
}): SupplierReliabilitySummary {
  const restaurantId = input.restaurantId.trim();
  if (!restaurantId) throw new Error("Supplier reliability requires a restaurant workspace.");
  requireTimeZone(input.restaurantTimeZone);
  requireTenantScope(restaurantId, input.orders, input.deliveries, input.items);

  const ordersById = new Map(input.orders.map((order) => [order.id, order]));
  const itemsByDelivery = new Map<string, SupplierDeliveryItemRecord[]>();
  for (const item of input.items) {
    const current = itemsByDelivery.get(item.delivery_id) ?? [];
    current.push(item);
    itemsByDelivery.set(item.delivery_id, current);
  }

  const suppliers = new Map<string, SupplierAccumulator>();
  for (const delivery of input.deliveries) {
    const order = ordersById.get(delivery.supplier_order_id);
    if (!order) continue;
    const key = order.supplier_name.trim().toLocaleLowerCase();
    if (!key) continue;
    const current = suppliers.get(key) ?? {
      supplierName: order.supplier_name.trim(),
      deliveries: [],
      orders: [],
      items: []
    };
    current.deliveries.push(delivery);
    current.orders.push(order);
    current.items.push(...(itemsByDelivery.get(delivery.id) ?? []));
    suppliers.set(key, current);
  }

  const entries = [...suppliers.values()].map((supplier) =>
    summarizeSupplier(supplier, input.restaurantTimeZone)
  );
  entries.sort(compareReliabilityEntries);

  const measurable = entries.reduce((sum, entry) => sum + entry.measurableDeliveryCount, 0);
  const onTime = entries.reduce((sum, entry) => sum + entry.onTimeCount, 0);
  const matched = entries.reduce(
    (sum, entry) => sum + Math.round(entry.matchedDeliveryRate * entry.deliveryCount),
    0
  );
  const totalDeliveries = entries.reduce((sum, entry) => sum + entry.deliveryCount, 0);

  return {
    totalDeliveries,
    supplierCount: entries.length,
    attentionSupplierCount: entries.filter(
      (entry) => entry.status === "watch" || entry.status === "at_risk"
    ).length,
    overallOnTimeRate: measurable > 0 ? roundRate(onTime / measurable) : null,
    overallMatchedDeliveryRate:
      totalDeliveries > 0 ? roundRate(matched / totalDeliveries) : null,
    suppliers: entries
  };
}

/** Latest-first verification evidence for one supplier order detail screen. */
export function buildSupplierOrderDeliveryEvidence(input: {
  restaurantId: string;
  restaurantTimeZone: string;
  order: SupplierOrder;
  deliveries: readonly SupplierDeliveryRecord[];
  items: readonly SupplierDeliveryItemRecord[];
}): SupplierOrderDeliveryEvidence[] {
  const restaurantId = input.restaurantId.trim();
  if (!restaurantId) throw new Error("Supplier delivery evidence requires a restaurant workspace.");
  requireTimeZone(input.restaurantTimeZone);
  requireTenantScope(restaurantId, [input.order], input.deliveries, input.items);

  const evidence = input.deliveries
    .filter((delivery) => delivery.supplier_order_id === input.order.id)
    .map((delivery) => {
      const lines = input.items.filter((item) => item.delivery_id === delivery.id);
      const receivedAt = new Date(delivery.received_at);
      const receivedDate = Number.isFinite(receivedAt.getTime())
        ? toDateKeyInTimeZone(receivedAt, input.restaurantTimeZone)
        : null;
      const timing: SupplierDeliveryTiming =
        !receivedDate || !validDateKey(input.order.delivery_date)
          ? "unmeasured"
          : receivedDate <= input.order.delivery_date
            ? "on_time"
            : "late";
      return {
        deliveryId: delivery.id,
        status: delivery.status,
        receivedAt: delivery.received_at,
        timing,
        lineCount: lines.length,
        discrepancyLineCount: lines.filter(isDiscrepancyLine).length,
        missingLineCount: lines.filter((line) => (finiteNonNegative(line.missing_quantity) ?? 0) > 0)
          .length,
        damagedLineCount: lines.filter((line) => (finiteNonNegative(line.damaged_quantity) ?? 0) > 0)
          .length,
        notes: delivery.notes?.trim() || null
      } satisfies SupplierOrderDeliveryEvidence;
    });
  return evidence.sort((left, right) => right.receivedAt.localeCompare(left.receivedAt));
}

function summarizeSupplier(
  supplier: SupplierAccumulator,
  restaurantTimeZone: string
): SupplierReliabilityEntry {
  let measurableDeliveryCount = 0;
  let onTimeCount = 0;
  let issueDeliveryCount = 0;
  let unverifiedDeliveryCount = 0;
  const relatedOrderIds = new Set<string>();

  supplier.deliveries.forEach((delivery, index) => {
    const order = supplier.orders[index]!;
    relatedOrderIds.add(order.id);
    if (ISSUE_STATUSES.has(delivery.status)) issueDeliveryCount += 1;
    if (delivery.status === "unverified") unverifiedDeliveryCount += 1;
    if (validDateKey(order.delivery_date)) {
      measurableDeliveryCount += 1;
      const receivedDate = toDateKeyInTimeZone(new Date(delivery.received_at), restaurantTimeZone);
      if (receivedDate <= order.delivery_date) onTimeCount += 1;
    }
  });

  let orderedQuantity = 0;
  let goodReceivedQuantity = 0;
  let discrepancyLineCount = 0;
  for (const item of supplier.items) {
    const ordered = finiteNonNegative(item.ordered_quantity);
    const received = finiteNonNegative(item.received_quantity);
    const damaged = finiteNonNegative(item.damaged_quantity);
    const missing = finiteNonNegative(item.missing_quantity);
    if (ordered != null && ordered > 0) {
      orderedQuantity += ordered;
      goodReceivedQuantity += Math.min(ordered, Math.max(0, (received ?? 0) - (damaged ?? 0)));
    }
    if ((damaged ?? 0) > 0 || (missing ?? 0) > 0 || Boolean(item.discrepancy_reason?.trim())) {
      discrepancyLineCount += 1;
    }
  }

  const deliveryCount = supplier.deliveries.length;
  const matchedCount = supplier.deliveries.filter((delivery) => delivery.status === "received").length;
  const onTimeRate = measurableDeliveryCount > 0 ? roundRate(onTimeCount / measurableDeliveryCount) : null;
  const matchedDeliveryRate = deliveryCount > 0 ? roundRate(matchedCount / deliveryCount) : 0;
  const fulfillmentRate = orderedQuantity > 0 ? roundRate(goodReceivedQuantity / orderedQuantity) : null;
  const lateRate = onTimeRate == null ? 0 : 1 - onTimeRate;
  const issueRate = deliveryCount > 0 ? issueDeliveryCount / deliveryCount : 0;

  const status = reliabilityStatus({
    deliveryCount,
    issueDeliveryCount,
    unverifiedDeliveryCount,
    discrepancyLineCount,
    issueRate,
    lateRate,
    fulfillmentRate
  });

  return {
    supplierName: supplier.supplierName,
    status,
    deliveryCount,
    onTimeCount,
    measurableDeliveryCount,
    issueDeliveryCount,
    unverifiedDeliveryCount,
    discrepancyLineCount,
    onTimeRate,
    matchedDeliveryRate,
    fulfillmentRate,
    reasons: reliabilityReasons({
      deliveryCount,
      onTimeRate,
      issueDeliveryCount,
      unverifiedDeliveryCount,
      discrepancyLineCount,
      fulfillmentRate
    }),
    lastDeliveryAt: supplier.deliveries
      .map((delivery) => delivery.received_at)
      .sort((left, right) => right.localeCompare(left))[0]!,
    relatedOrderIds: [...relatedOrderIds]
  };
}

function reliabilityStatus(input: {
  deliveryCount: number;
  issueDeliveryCount: number;
  unverifiedDeliveryCount: number;
  discrepancyLineCount: number;
  issueRate: number;
  lateRate: number;
  fulfillmentRate: number | null;
}): SupplierReliabilityStatus {
  const hasAttention =
    input.issueDeliveryCount > 0 ||
    input.unverifiedDeliveryCount > 0 ||
    input.discrepancyLineCount > 0 ||
    input.lateRate > 0 ||
    (input.fulfillmentRate != null && input.fulfillmentRate < 0.98);
  if (input.deliveryCount < 2) return hasAttention ? "watch" : "insufficient";
  if (
    input.issueRate >= 0.25 ||
    input.lateRate >= 0.34 ||
    (input.fulfillmentRate != null && input.fulfillmentRate < 0.9)
  ) {
    return "at_risk";
  }
  return hasAttention ? "watch" : "reliable";
}

function reliabilityReasons(input: {
  deliveryCount: number;
  onTimeRate: number | null;
  issueDeliveryCount: number;
  unverifiedDeliveryCount: number;
  discrepancyLineCount: number;
  fulfillmentRate: number | null;
}): SupplierReliabilityReason[] {
  const reasons: SupplierReliabilityReason[] = [];
  if (input.deliveryCount < 2) reasons.push("limited_history");
  if (input.onTimeRate != null && input.onTimeRate < 1) reasons.push("late_deliveries");
  if (input.issueDeliveryCount > 0) reasons.push("delivery_discrepancies");
  if (input.discrepancyLineCount > 0 || (input.fulfillmentRate != null && input.fulfillmentRate < 0.98)) {
    reasons.push("underfilled_lines");
  }
  if (input.unverifiedDeliveryCount > 0) reasons.push("unverified_deliveries");
  if (reasons.length === 0) reasons.push("matched_history");
  return reasons;
}

function compareReliabilityEntries(left: SupplierReliabilityEntry, right: SupplierReliabilityEntry) {
  const rank: Record<SupplierReliabilityStatus, number> = {
    at_risk: 0,
    watch: 1,
    insufficient: 2,
    reliable: 3
  };
  return (
    rank[left.status] - rank[right.status] ||
    right.lastDeliveryAt.localeCompare(left.lastDeliveryAt) ||
    left.supplierName.localeCompare(right.supplierName)
  );
}

function isDiscrepancyLine(item: SupplierDeliveryItemRecord) {
  return (
    (finiteNonNegative(item.damaged_quantity) ?? 0) > 0 ||
    (finiteNonNegative(item.missing_quantity) ?? 0) > 0 ||
    Boolean(item.discrepancy_reason?.trim())
  );
}

function requireTenantScope(
  restaurantId: string,
  orders: readonly SupplierOrder[],
  deliveries: readonly SupplierDeliveryRecord[],
  items: readonly SupplierDeliveryItemRecord[]
) {
  if (
    orders.some((row) => row.restaurant_id !== restaurantId) ||
    deliveries.some((row) => row.restaurant_id !== restaurantId) ||
    items.some((row) => row.restaurant_id !== restaurantId)
  ) {
    throw new Error("Supplier reliability received cross-restaurant evidence.");
  }
}

function requireTimeZone(timeZone: string) {
  if (!timeZone.trim()) throw new Error("Supplier reliability requires a restaurant timezone.");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
  } catch {
    throw new Error("Supplier reliability requires a valid restaurant timezone.");
  }
}

function validDateKey(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function finiteNonNegative(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : null;
}

function roundRate(value: number) {
  return Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
}

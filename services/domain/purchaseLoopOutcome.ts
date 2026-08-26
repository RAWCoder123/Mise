/**
 * Purchase-loop outcome measurement (receive phase).
 *
 * Links predicted (recommendation) quantity, ordered quantity, and received
 * quantity into one append-only action_outcome payload. Later count variance is
 * intentionally left pending until a verified count measurement exists.
 *
 * Quantities share the same unit basis the delivery workflow already uses:
 * recommendation `recommended_quantity` paired with delivery-line canonical
 * quantities (demo and hosted receive currently treat those as comparable).
 */

export const PURCHASE_LOOP_OUTCOME_EVIDENCE_VERSION = "mise.purchase_loop_outcome.v1" as const;
export const PURCHASE_LOOP_RECEIVE_PHASE = "receive" as const;

export type PurchaseLoopDeliveryStatus = "received" | "discrepancy" | "partially_received";

export type PurchaseLoopLessonCode =
  | "purchase_loop.receive.matched"
  | "purchase_loop.receive.quantity_short"
  | "purchase_loop.receive.quantity_over"
  | "purchase_loop.receive.discrepancy"
  | "purchase_loop.receive.partial"
  | "purchase_loop.receive.prediction_gap";

export interface PurchaseLoopRecommendationInput {
  id: string;
  inventoryItemId: string;
  recommendedQuantity: number;
  unit: string;
  status: string;
}

export interface PurchaseLoopDeliveryLineInput {
  inventoryItemId: string;
  orderedQuantity: number | null;
  receivedQuantity: number;
  damagedQuantity?: number | null;
  missingQuantity?: number | null;
  canonicalUnit: string;
}

export interface PurchaseLoopLineMeasurement {
  inventoryItemId: string;
  recommendationId: string | null;
  unit: string;
  predictedQuantity: number | null;
  orderedQuantity: number | null;
  receivedQuantity: number;
  damagedQuantity: number;
  missingQuantity: number;
  usableReceivedQuantity: number;
  orderedVersusPredictedDelta: number | null;
  receivedVersusOrderedDelta: number | null;
  usableVersusPredictedDelta: number | null;
}

export interface PurchaseLoopReceiveOutcomeMeasurement {
  evidenceVersion: typeof PURCHASE_LOOP_OUTCOME_EVIDENCE_VERSION;
  phase: typeof PURCHASE_LOOP_RECEIVE_PHASE;
  expectedResult: Record<string, unknown>;
  actualResult: Record<string, unknown>;
  variance: Record<string, unknown>;
  lesson: string;
  lessonCode: PurchaseLoopLessonCode;
}

function requireFiniteNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000) {
    throw new Error(`${label} must be a bounded non-negative quantity.`);
  }
  return value;
}

function roundQuantity(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function sumNullable(values: ReadonlyArray<number | null | undefined>): number | null {
  let total = 0;
  let seen = false;
  for (const value of values) {
    if (value === null || value === undefined) continue;
    total += value;
    seen = true;
  }
  return seen ? roundQuantity(total) : null;
}

function delta(actual: number | null, expected: number | null): number | null {
  if (actual === null || expected === null) return null;
  return roundQuantity(actual - expected);
}

export function selectPurchaseLoopLessonCode(input: {
  deliveryStatus: PurchaseLoopDeliveryStatus;
  predictedQuantity: number | null;
  orderedQuantity: number | null;
  usableReceivedQuantity: number;
  hasDiscrepancy: boolean;
  hasPartialReceipt: boolean;
}): PurchaseLoopLessonCode {
  if (input.hasDiscrepancy || input.deliveryStatus === "discrepancy") {
    return "purchase_loop.receive.discrepancy";
  }
  if (input.hasPartialReceipt || input.deliveryStatus === "partially_received") {
    return "purchase_loop.receive.partial";
  }
  if (
    input.predictedQuantity !== null &&
    input.orderedQuantity !== null &&
    Math.abs(input.orderedQuantity - input.predictedQuantity) > 0.000001
  ) {
    return "purchase_loop.receive.prediction_gap";
  }
  if (input.orderedQuantity !== null) {
    if (input.usableReceivedQuantity + 0.000001 < input.orderedQuantity) {
      return "purchase_loop.receive.quantity_short";
    }
    if (input.usableReceivedQuantity > input.orderedQuantity + 0.000001) {
      return "purchase_loop.receive.quantity_over";
    }
  }
  return "purchase_loop.receive.matched";
}

export function lessonTextForPurchaseLoopCode(code: PurchaseLoopLessonCode): string {
  switch (code) {
    case "purchase_loop.receive.matched":
      return "Predicted, ordered, and received quantities matched for this supplier order.";
    case "purchase_loop.receive.quantity_short":
      return "Received quantity was short of the ordered amount; review before trusting fill rates.";
    case "purchase_loop.receive.quantity_over":
      return "Received quantity exceeded the ordered amount; confirm before adjusting pars.";
    case "purchase_loop.receive.discrepancy":
      return "Delivery recorded damage, missing stock, or another discrepancy against the order.";
    case "purchase_loop.receive.partial":
      return "Delivery was only partially received relative to the ordered quantity.";
    case "purchase_loop.receive.prediction_gap":
      return "Ordered quantity differed from the Mise prediction; keep this evidence for learning.";
    default: {
      const _exhaustive: never = code;
      return _exhaustive;
    }
  }
}

/**
 * Builds the receive-phase purchase-loop outcome payload for one supplier order.
 * Does not invent later count variance; marks it pending for a future measurement.
 */
export function buildPurchaseLoopReceiveOutcomeMeasurement(input: {
  supplierOrderId: string;
  deliveryId: string;
  deliveryStatus: PurchaseLoopDeliveryStatus;
  hasDiscrepancy?: boolean;
  hasPartialReceipt?: boolean;
  recommendations: readonly PurchaseLoopRecommendationInput[];
  lines: readonly PurchaseLoopDeliveryLineInput[];
}): PurchaseLoopReceiveOutcomeMeasurement {
  const supplierOrderId = input.supplierOrderId.trim();
  const deliveryId = input.deliveryId.trim();
  if (!supplierOrderId) throw new Error("Purchase-loop outcomes require a supplier order id.");
  if (!deliveryId) throw new Error("Purchase-loop outcomes require a delivery id.");
  if (input.lines.length < 1 || input.lines.length > 200) {
    throw new Error("Purchase-loop outcomes require between 1 and 200 delivery lines.");
  }

  const recommendationsByItem = new Map<string, PurchaseLoopRecommendationInput>();
  for (const recommendation of input.recommendations) {
    const itemId = recommendation.inventoryItemId.trim();
    if (!itemId) continue;
    if (
      recommendation.status !== "ordered" &&
      recommendation.status !== "approved"
    ) {
      continue;
    }
    const quantity = requireFiniteNonNegative(
      Number(recommendation.recommendedQuantity),
      "Predicted quantity"
    );
    const existing = recommendationsByItem.get(itemId);
    if (!existing || quantity >= existing.recommendedQuantity) {
      recommendationsByItem.set(itemId, {
        ...recommendation,
        inventoryItemId: itemId,
        recommendedQuantity: quantity,
        unit: recommendation.unit.trim() || "each"
      });
    }
  }

  const lineMeasurements: PurchaseLoopLineMeasurement[] = input.lines.map((line) => {
    const inventoryItemId = line.inventoryItemId.trim();
    if (!inventoryItemId) {
      throw new Error("Delivery lines require an inventory item id.");
    }
    const receivedQuantity = requireFiniteNonNegative(
      Number(line.receivedQuantity),
      "Received quantity"
    );
    const damagedQuantity = requireFiniteNonNegative(
      Number(line.damagedQuantity ?? 0),
      "Damaged quantity"
    );
    const missingQuantity = requireFiniteNonNegative(
      Number(line.missingQuantity ?? 0),
      "Missing quantity"
    );
    if (damagedQuantity > receivedQuantity) {
      throw new Error("Damaged quantity cannot exceed received quantity.");
    }
    const orderedQuantity =
      line.orderedQuantity === null || line.orderedQuantity === undefined
        ? null
        : requireFiniteNonNegative(Number(line.orderedQuantity), "Ordered quantity");
    const recommendation = recommendationsByItem.get(inventoryItemId) ?? null;
    const predictedQuantity = recommendation?.recommendedQuantity ?? null;
    const usableReceivedQuantity = roundQuantity(receivedQuantity - damagedQuantity);

    return {
      inventoryItemId,
      recommendationId: recommendation?.id ?? null,
      unit: (line.canonicalUnit || recommendation?.unit || "each").trim(),
      predictedQuantity,
      orderedQuantity,
      receivedQuantity,
      damagedQuantity,
      missingQuantity,
      usableReceivedQuantity,
      orderedVersusPredictedDelta: delta(orderedQuantity, predictedQuantity),
      receivedVersusOrderedDelta: delta(receivedQuantity, orderedQuantity),
      usableVersusPredictedDelta: delta(usableReceivedQuantity, predictedQuantity)
    };
  });

  const predictedQuantity = sumNullable(
    lineMeasurements.map((line) => line.predictedQuantity)
  );
  const orderedQuantity = sumNullable(lineMeasurements.map((line) => line.orderedQuantity));
  const receivedQuantity = roundQuantity(
    lineMeasurements.reduce((total, line) => total + line.receivedQuantity, 0)
  );
  const damagedQuantity = roundQuantity(
    lineMeasurements.reduce((total, line) => total + line.damagedQuantity, 0)
  );
  const missingQuantity = roundQuantity(
    lineMeasurements.reduce((total, line) => total + line.missingQuantity, 0)
  );
  const usableReceivedQuantity = roundQuantity(receivedQuantity - damagedQuantity);

  const hasDiscrepancy =
    input.hasDiscrepancy === true ||
    input.deliveryStatus === "discrepancy" ||
    damagedQuantity > 0 ||
    missingQuantity > 0;
  const hasPartialReceipt =
    input.hasPartialReceipt === true ||
    input.deliveryStatus === "partially_received" ||
    (orderedQuantity !== null && receivedQuantity + missingQuantity < orderedQuantity);

  const lessonCode = selectPurchaseLoopLessonCode({
    deliveryStatus: input.deliveryStatus,
    predictedQuantity,
    orderedQuantity,
    usableReceivedQuantity,
    hasDiscrepancy,
    hasPartialReceipt
  });

  const expectedResult: Record<string, unknown> = {
    evidenceVersion: PURCHASE_LOOP_OUTCOME_EVIDENCE_VERSION,
    phase: PURCHASE_LOOP_RECEIVE_PHASE,
    deliveryStatus: "received",
    predictedQuantity,
    orderedQuantity: orderedQuantity ?? predictedQuantity,
    receivedQuantity: orderedQuantity ?? predictedQuantity,
    usableReceivedQuantity: orderedQuantity ?? predictedQuantity
  };

  const actualResult: Record<string, unknown> = {
    evidenceVersion: PURCHASE_LOOP_OUTCOME_EVIDENCE_VERSION,
    phase: PURCHASE_LOOP_RECEIVE_PHASE,
    deliveryStatus: input.deliveryStatus,
    deliveryId,
    supplierOrderId,
    lineCount: lineMeasurements.length,
    recommendationCount: recommendationsByItem.size,
    predictedQuantity,
    orderedQuantity,
    receivedQuantity,
    damagedQuantity,
    missingQuantity,
    usableReceivedQuantity,
    countVariancePending: true,
    lines: lineMeasurements.map((line) => ({
      inventoryItemId: line.inventoryItemId,
      recommendationId: line.recommendationId,
      unit: line.unit,
      predictedQuantity: line.predictedQuantity,
      orderedQuantity: line.orderedQuantity,
      receivedQuantity: line.receivedQuantity,
      damagedQuantity: line.damagedQuantity,
      missingQuantity: line.missingQuantity,
      usableReceivedQuantity: line.usableReceivedQuantity
    }))
  };

  const variance: Record<string, unknown> = {
    evidenceVersion: PURCHASE_LOOP_OUTCOME_EVIDENCE_VERSION,
    phase: PURCHASE_LOOP_RECEIVE_PHASE,
    deliveryStatusMatched: input.deliveryStatus === "received",
    hasDiscrepancy,
    hasPartialReceipt,
    countVariancePending: true,
    predictedQuantity,
    orderedQuantity,
    receivedQuantity,
    usableReceivedQuantity,
    orderedVersusPredictedDelta: delta(orderedQuantity, predictedQuantity),
    receivedVersusOrderedDelta: delta(receivedQuantity, orderedQuantity),
    usableVersusPredictedDelta: delta(usableReceivedQuantity, predictedQuantity),
    usableVersusOrderedDelta: delta(usableReceivedQuantity, orderedQuantity),
    lineCount: lineMeasurements.length,
    linesWithPrediction: lineMeasurements.filter((line) => line.predictedQuantity !== null).length,
    linesWithOrderQuantity: lineMeasurements.filter((line) => line.orderedQuantity !== null).length
  };

  return {
    evidenceVersion: PURCHASE_LOOP_OUTCOME_EVIDENCE_VERSION,
    phase: PURCHASE_LOOP_RECEIVE_PHASE,
    expectedResult,
    actualResult,
    variance,
    lesson: lessonTextForPurchaseLoopCode(lessonCode),
    lessonCode
  };
}

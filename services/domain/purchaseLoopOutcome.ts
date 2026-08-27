/**
 * Purchase-loop outcome measurement (receive + post-count phases).
 *
 * Receive links predicted (recommendation) quantity, ordered quantity, and
 * received quantity into one append-only action_outcome payload and leaves
 * later count variance pending. Count approval closes that loop by comparing
 * counted quantity to the system quantity at count start for items that still
 * have pending receive-phase purchase-loop evidence.
 *
 * Quantities share the same unit basis the delivery/count workflows already use:
 * recommendation `recommended_quantity` paired with delivery-line / count-line
 * purchase units (demo and hosted paths currently treat those as comparable).
 */

export const PURCHASE_LOOP_OUTCOME_EVIDENCE_VERSION = "mise.purchase_loop_outcome.v1" as const;
export const PURCHASE_LOOP_RECEIVE_PHASE = "receive" as const;
export const PURCHASE_LOOP_COUNT_PHASE = "count" as const;

export type PurchaseLoopDeliveryStatus = "received" | "discrepancy" | "partially_received";

export type PurchaseLoopLessonCode =
  | "purchase_loop.receive.matched"
  | "purchase_loop.receive.quantity_short"
  | "purchase_loop.receive.quantity_over"
  | "purchase_loop.receive.discrepancy"
  | "purchase_loop.receive.partial"
  | "purchase_loop.receive.prediction_gap";

export type PurchaseLoopCountLessonCode =
  | "purchase_loop.count.matched"
  | "purchase_loop.count.short"
  | "purchase_loop.count.over"
  | "purchase_loop.count.mixed";

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

export interface PurchaseLoopPriorReceiveLine {
  inventoryItemId: string;
  recommendationId: string | null;
  unit: string;
  predictedQuantity: number | null;
  orderedQuantity: number | null;
  receivedQuantity: number;
  usableReceivedQuantity: number;
  deliveryId: string | null;
  supplierOrderId: string | null;
  receiveOutcomeId: string | null;
  measuredAt: string | null;
}

export interface PurchaseLoopCountLineInput {
  inventoryItemId: string;
  unit: string;
  systemQuantityAtStart: number;
  countedQuantity: number;
  quantityBefore: number;
  quantityAfter: number;
}

export interface PurchaseLoopCountLineMeasurement {
  inventoryItemId: string;
  recommendationId: string | null;
  unit: string;
  predictedQuantity: number | null;
  orderedQuantity: number | null;
  receivedQuantity: number;
  usableReceivedQuantity: number;
  systemQuantityAtStart: number;
  countedQuantity: number;
  quantityBefore: number;
  quantityAfter: number;
  varianceFromSystem: number;
  countedVersusUsableReceivedDelta: number;
  deliveryId: string | null;
  supplierOrderId: string | null;
  receiveOutcomeId: string | null;
}

export interface PurchaseLoopCountOutcomeMeasurement {
  evidenceVersion: typeof PURCHASE_LOOP_OUTCOME_EVIDENCE_VERSION;
  phase: typeof PURCHASE_LOOP_COUNT_PHASE;
  expectedResult: Record<string, unknown>;
  actualResult: Record<string, unknown>;
  variance: Record<string, unknown>;
  lesson: string;
  lessonCode: PurchaseLoopCountLessonCode;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Reads pending receive-phase purchase-loop lines from stored action outcomes.
 * Prefers the newest pending receive evidence per inventory item.
 */
export function selectPendingPurchaseLoopReceiveLines(input: {
  outcomes: readonly {
    id: string;
    restaurantId: string;
    measuredAt: string;
    actualResult: Record<string, unknown>;
  }[];
  restaurantId: string;
  inventoryItemIds?: ReadonlySet<string> | readonly string[];
}): PurchaseLoopPriorReceiveLine[] {
  const restaurantId = input.restaurantId.trim();
  if (!restaurantId) return [];

  const allowedIds =
    input.inventoryItemIds == null
      ? null
      : input.inventoryItemIds instanceof Set
        ? input.inventoryItemIds
        : new Set(
            [...input.inventoryItemIds]
              .map((id) => id.trim())
              .filter((id) => id.length > 0)
          );

  const byItem = new Map<string, PurchaseLoopPriorReceiveLine>();

  const sorted = [...input.outcomes]
    .filter((outcome) => outcome.restaurantId === restaurantId)
    .sort((left, right) => {
      const leftAt = Date.parse(left.measuredAt);
      const rightAt = Date.parse(right.measuredAt);
      if (Number.isFinite(leftAt) && Number.isFinite(rightAt) && leftAt !== rightAt) {
        return rightAt - leftAt;
      }
      return right.id.localeCompare(left.id);
    });

  for (const outcome of sorted) {
    const actual = outcome.actualResult ?? {};
    if (actual.evidenceVersion !== PURCHASE_LOOP_OUTCOME_EVIDENCE_VERSION) continue;
    if (actual.phase !== PURCHASE_LOOP_RECEIVE_PHASE) continue;
    if (actual.countVariancePending !== true) continue;

    const deliveryId = asOptionalString(actual.deliveryId);
    const supplierOrderId = asOptionalString(actual.supplierOrderId);
    const lines = Array.isArray(actual.lines) ? actual.lines : [];

    for (const rawLine of lines) {
      if (!rawLine || typeof rawLine !== "object") continue;
      const line = rawLine as Record<string, unknown>;
      const inventoryItemId = asOptionalString(line.inventoryItemId);
      if (!inventoryItemId) continue;
      if (allowedIds && !allowedIds.has(inventoryItemId)) continue;
      if (byItem.has(inventoryItemId)) continue;

      const receivedQuantity = asFiniteNumber(line.receivedQuantity);
      const usableReceivedQuantity = asFiniteNumber(line.usableReceivedQuantity);
      if (receivedQuantity === null || usableReceivedQuantity === null) continue;
      if (receivedQuantity < 0 || usableReceivedQuantity < 0) continue;

      byItem.set(inventoryItemId, {
        inventoryItemId,
        recommendationId: asOptionalString(line.recommendationId),
        unit: asOptionalString(line.unit) ?? "each",
        predictedQuantity: asFiniteNumber(line.predictedQuantity),
        orderedQuantity: asFiniteNumber(line.orderedQuantity),
        receivedQuantity: requireFiniteNonNegative(receivedQuantity, "Received quantity"),
        usableReceivedQuantity: requireFiniteNonNegative(
          usableReceivedQuantity,
          "Usable received quantity"
        ),
        deliveryId,
        supplierOrderId,
        receiveOutcomeId: outcome.id,
        measuredAt: outcome.measuredAt
      });
    }
  }

  return [...byItem.values()];
}

export function selectPurchaseLoopCountLessonCode(input: {
  shortCount: number;
  overCount: number;
  matchedCount: number;
}): PurchaseLoopCountLessonCode {
  if (input.shortCount > 0 && input.overCount > 0) {
    return "purchase_loop.count.mixed";
  }
  if (input.shortCount > 0) {
    return "purchase_loop.count.short";
  }
  if (input.overCount > 0) {
    return "purchase_loop.count.over";
  }
  return "purchase_loop.count.matched";
}

export function lessonTextForPurchaseLoopCountCode(code: PurchaseLoopCountLessonCode): string {
  switch (code) {
    case "purchase_loop.count.matched":
      return "Post-receive count matched the system quantity for purchase-loop items.";
    case "purchase_loop.count.short":
      return "Post-receive count was short of the system quantity; review waste or depletion before trusting pars.";
    case "purchase_loop.count.over":
      return "Post-receive count exceeded the system quantity; confirm receiving or conversion before adjusting pars.";
    case "purchase_loop.count.mixed":
      return "Post-receive count showed both short and over variances across purchase-loop items.";
    default: {
      const _exhaustive: never = code;
      return _exhaustive;
    }
  }
}

/**
 * Builds the count-phase purchase-loop outcome for items that still have
 * pending receive-phase evidence. Returns null when no overlapping items exist
 * so callers do not invent an empty learning record.
 */
export function buildPurchaseLoopCountVarianceMeasurement(input: {
  countSessionId: string;
  priorReceiveLines: readonly PurchaseLoopPriorReceiveLine[];
  countLines: readonly PurchaseLoopCountLineInput[];
}): PurchaseLoopCountOutcomeMeasurement | null {
  const countSessionId = input.countSessionId.trim();
  if (!countSessionId) throw new Error("Purchase-loop count outcomes require a count session id.");
  if (input.countLines.length < 1 || input.countLines.length > 500) {
    throw new Error("Purchase-loop count outcomes require between 1 and 500 count lines.");
  }
  if (input.priorReceiveLines.length > 200) {
    throw new Error("Purchase-loop count outcomes accept at most 200 prior receive lines.");
  }

  const priorByItem = new Map<string, PurchaseLoopPriorReceiveLine>();
  for (const prior of input.priorReceiveLines) {
    const inventoryItemId = prior.inventoryItemId.trim();
    if (!inventoryItemId) continue;
    if (!priorByItem.has(inventoryItemId)) {
      priorByItem.set(inventoryItemId, {
        ...prior,
        inventoryItemId,
        unit: prior.unit.trim() || "each",
        predictedQuantity:
          prior.predictedQuantity === null
            ? null
            : requireFiniteNonNegative(prior.predictedQuantity, "Predicted quantity"),
        orderedQuantity:
          prior.orderedQuantity === null
            ? null
            : requireFiniteNonNegative(prior.orderedQuantity, "Ordered quantity"),
        receivedQuantity: requireFiniteNonNegative(prior.receivedQuantity, "Received quantity"),
        usableReceivedQuantity: requireFiniteNonNegative(
          prior.usableReceivedQuantity,
          "Usable received quantity"
        )
      });
    }
  }

  const lineMeasurements: PurchaseLoopCountLineMeasurement[] = [];
  for (const line of input.countLines) {
    const inventoryItemId = line.inventoryItemId.trim();
    if (!inventoryItemId) {
      throw new Error("Count lines require an inventory item id.");
    }
    const prior = priorByItem.get(inventoryItemId);
    if (!prior) continue;

    const systemQuantityAtStart = requireFiniteNonNegative(
      Number(line.systemQuantityAtStart),
      "System quantity at start"
    );
    const countedQuantity = requireFiniteNonNegative(
      Number(line.countedQuantity),
      "Counted quantity"
    );
    const quantityBefore = requireFiniteNonNegative(Number(line.quantityBefore), "Quantity before");
    const quantityAfter = requireFiniteNonNegative(Number(line.quantityAfter), "Quantity after");

    lineMeasurements.push({
      inventoryItemId,
      recommendationId: prior.recommendationId,
      unit: (line.unit || prior.unit || "each").trim(),
      predictedQuantity: prior.predictedQuantity,
      orderedQuantity: prior.orderedQuantity,
      receivedQuantity: prior.receivedQuantity,
      usableReceivedQuantity: prior.usableReceivedQuantity,
      systemQuantityAtStart,
      countedQuantity,
      quantityBefore,
      quantityAfter,
      varianceFromSystem: roundQuantity(countedQuantity - systemQuantityAtStart),
      countedVersusUsableReceivedDelta: roundQuantity(
        countedQuantity - prior.usableReceivedQuantity
      ),
      deliveryId: prior.deliveryId,
      supplierOrderId: prior.supplierOrderId,
      receiveOutcomeId: prior.receiveOutcomeId
    });
  }

  if (lineMeasurements.length < 1) {
    return null;
  }

  let shortCount = 0;
  let overCount = 0;
  let matchedCount = 0;
  for (const line of lineMeasurements) {
    if (line.varianceFromSystem < -0.000001) shortCount += 1;
    else if (line.varianceFromSystem > 0.000001) overCount += 1;
    else matchedCount += 1;
  }

  const lessonCode = selectPurchaseLoopCountLessonCode({
    shortCount,
    overCount,
    matchedCount
  });

  const predictedQuantity = sumNullable(
    lineMeasurements.map((line) => line.predictedQuantity)
  );
  const orderedQuantity = sumNullable(lineMeasurements.map((line) => line.orderedQuantity));
  const receivedQuantity = roundQuantity(
    lineMeasurements.reduce((total, line) => total + line.receivedQuantity, 0)
  );
  const usableReceivedQuantity = roundQuantity(
    lineMeasurements.reduce((total, line) => total + line.usableReceivedQuantity, 0)
  );
  const systemQuantityAtStart = roundQuantity(
    lineMeasurements.reduce((total, line) => total + line.systemQuantityAtStart, 0)
  );
  const countedQuantity = roundQuantity(
    lineMeasurements.reduce((total, line) => total + line.countedQuantity, 0)
  );
  const varianceFromSystem = roundQuantity(countedQuantity - systemQuantityAtStart);

  const expectedResult: Record<string, unknown> = {
    evidenceVersion: PURCHASE_LOOP_OUTCOME_EVIDENCE_VERSION,
    phase: PURCHASE_LOOP_COUNT_PHASE,
    countSessionId,
    predictedQuantity,
    orderedQuantity,
    receivedQuantity: usableReceivedQuantity,
    usableReceivedQuantity,
    systemQuantityAtStart,
    countedQuantity: systemQuantityAtStart
  };

  const actualResult: Record<string, unknown> = {
    evidenceVersion: PURCHASE_LOOP_OUTCOME_EVIDENCE_VERSION,
    phase: PURCHASE_LOOP_COUNT_PHASE,
    countSessionId,
    lineCount: lineMeasurements.length,
    predictedQuantity,
    orderedQuantity,
    receivedQuantity,
    usableReceivedQuantity,
    systemQuantityAtStart,
    countedQuantity,
    countVariancePending: false,
    linkedReceiveOutcomeIds: [
      ...new Set(
        lineMeasurements
          .map((line) => line.receiveOutcomeId)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      )
    ],
    lines: lineMeasurements.map((line) => ({
      inventoryItemId: line.inventoryItemId,
      recommendationId: line.recommendationId,
      unit: line.unit,
      predictedQuantity: line.predictedQuantity,
      orderedQuantity: line.orderedQuantity,
      receivedQuantity: line.receivedQuantity,
      usableReceivedQuantity: line.usableReceivedQuantity,
      systemQuantityAtStart: line.systemQuantityAtStart,
      countedQuantity: line.countedQuantity,
      quantityBefore: line.quantityBefore,
      quantityAfter: line.quantityAfter,
      varianceFromSystem: line.varianceFromSystem,
      countedVersusUsableReceivedDelta: line.countedVersusUsableReceivedDelta,
      deliveryId: line.deliveryId,
      supplierOrderId: line.supplierOrderId,
      receiveOutcomeId: line.receiveOutcomeId
    }))
  };

  const variance: Record<string, unknown> = {
    evidenceVersion: PURCHASE_LOOP_OUTCOME_EVIDENCE_VERSION,
    phase: PURCHASE_LOOP_COUNT_PHASE,
    countSessionId,
    countVariancePending: false,
    predictedQuantity,
    orderedQuantity,
    receivedQuantity,
    usableReceivedQuantity,
    systemQuantityAtStart,
    countedQuantity,
    varianceFromSystem,
    countedVersusUsableReceivedDelta: roundQuantity(countedQuantity - usableReceivedQuantity),
    shortCount,
    overCount,
    matchedCount,
    lineCount: lineMeasurements.length
  };

  return {
    evidenceVersion: PURCHASE_LOOP_OUTCOME_EVIDENCE_VERSION,
    phase: PURCHASE_LOOP_COUNT_PHASE,
    expectedResult,
    actualResult,
    variance,
    lesson: lessonTextForPurchaseLoopCountCode(lessonCode),
    lessonCode
  };
}

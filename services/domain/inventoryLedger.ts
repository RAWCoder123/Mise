import { COUNT_CLOCK_SKEW_TOLERANCE_MS, isTemporallyValidCount } from "./inventoryCountAuthority";
import type { CanonicalOperationalUnit } from "./operationalMapping";
import { INVENTORY_EVENT_EFFECTIVE_AT_MAX_LOOKBACK_MS } from "./securityLimits";

export type InventoryEventType =
  | "receipt"
  | "count"
  | "waste"
  | "stockout"
  | "usage"
  | "adjustment"
  | "transfer"
  | "correction";

export interface InventoryEvent {
  id: string;
  sequence: number;
  restaurantId: string;
  inventoryItemId: string;
  eventType: InventoryEventType;
  quantity: number;
  canonicalUnit: CanonicalOperationalUnit;
  effectiveAt: string;
  recordedAt: string;
  actorUserId: string | null;
  source: string;
  sourceReference: string | null;
  reasonCode: string | null;
  clientEventId: string;
  idempotencyKey: string;
  supersedesEventId: string | null;
  metadata: Readonly<Record<string, unknown>>;
  /**
   * Whether this row moved the on-hand projection. False when it was retained in
   * history but fell at or before the item's authoritative count boundary. Absent on
   * legacy rows, which are read as applied — the fail-closed interpretation.
   */
  projectionApplied?: boolean;
}

export type InventoryEventInput = Omit<
  InventoryEvent,
  "id" | "sequence" | "recordedAt" | "actorUserId" | "projectionApplied"
>;

export type InventoryEventAcceptance =
  | { status: "accepted"; event: InventoryEvent }
  | { status: "duplicate"; event: InventoryEvent }
  | { status: "conflict"; reason: string; existingEvent: InventoryEvent | null }
  | { status: "rejected"; reason: string };

export interface InventoryProjection {
  restaurantId: string;
  inventoryItemId: string;
  canonicalUnit: CanonicalOperationalUnit | null;
  quantity: number;
  lastSequence: number;
  conflicts: string[];
}

export function acceptInventoryEvent(input: {
  existingEvents: readonly InventoryEvent[];
  candidate: InventoryEventInput;
  authority: { id: string; actorUserId: string; recordedAt: string };
}): InventoryEventAcceptance {
  const invalidReason = validateEventInput(input.candidate, input.authority.recordedAt);
  if (invalidReason) return { status: "rejected", reason: invalidReason };

  const sameClientEvent = input.existingEvents.find(
    (event) =>
      event.restaurantId === input.candidate.restaurantId &&
      event.clientEventId === input.candidate.clientEventId
  );
  const sameIdempotencyKey = input.existingEvents.find(
    (event) =>
      event.restaurantId === input.candidate.restaurantId &&
      event.idempotencyKey === input.candidate.idempotencyKey
  );
  const existing = sameClientEvent ?? sameIdempotencyKey;
  if (existing) {
    return sameEventPayload(existing, input.candidate)
      ? { status: "duplicate", event: existing }
      : { status: "conflict", reason: "idempotency_payload_mismatch", existingEvent: existing };
  }

  if (input.candidate.supersedesEventId) {
    if (input.candidate.eventType !== "correction") {
      return { status: "rejected", reason: "only_corrections_can_supersede" };
    }
    const superseded = input.existingEvents.find(
      (event) => event.id === input.candidate.supersedesEventId
    );
    if (
      !superseded ||
      superseded.restaurantId !== input.candidate.restaurantId ||
      superseded.inventoryItemId !== input.candidate.inventoryItemId
    ) {
      return { status: "conflict", reason: "superseded_event_not_found", existingEvent: null };
    }
    if (
      input.existingEvents.some(
        (event) =>
          event.restaurantId === input.candidate.restaurantId &&
          event.supersedesEventId === input.candidate.supersedesEventId
      )
    ) {
      return { status: "conflict", reason: "event_already_superseded", existingEvent: superseded };
    }
  }

  const maximumSequence = input.existingEvents.reduce(
    (maximum, event) => Math.max(maximum, event.sequence),
    0
  );
  return {
    status: "accepted",
    event: {
      ...input.candidate,
      id: input.authority.id,
      sequence: maximumSequence + 1,
      actorUserId: input.authority.actorUserId,
      recordedAt: input.authority.recordedAt
    }
  };
}

export function projectInventoryEvents(
  restaurantId: string,
  inventoryItemId: string,
  events: readonly InventoryEvent[]
): InventoryProjection {
  const scoped = events
    .filter(
      (event) =>
        event.restaurantId === restaurantId && event.inventoryItemId === inventoryItemId
    )
    .sort((left, right) => left.sequence - right.sequence);
  let quantity = 0;
  let canonicalUnit: CanonicalOperationalUnit | null = null;
  const conflicts: string[] = [];

  for (const event of scoped) {
    if (canonicalUnit && canonicalUnit !== event.canonicalUnit) {
      conflicts.push(`unit_mismatch:${event.id}`);
      continue;
    }
    canonicalUnit = event.canonicalUnit;
    if (event.eventType === "count") {
      quantity = event.quantity;
    } else if (event.eventType === "stockout") {
      quantity = 0;
    } else if (event.eventType === "receipt") {
      quantity += event.quantity;
    } else if (event.eventType === "waste" || event.eventType === "usage") {
      quantity -= event.quantity;
    } else {
      quantity += event.quantity;
    }
  }

  return {
    restaurantId,
    inventoryItemId,
    canonicalUnit,
    quantity,
    lastSequence: scoped.at(-1)?.sequence ?? 0,
    conflicts
  };
}

function validateEventInput(input: InventoryEventInput, recordedAt: string) {
  if (!input.restaurantId.trim() || !input.inventoryItemId.trim()) return "missing_scope";
  if (!input.clientEventId.trim() || !input.idempotencyKey.trim()) return "missing_idempotency";
  if (!input.source.trim()) return "missing_source";
  if (!Number.isFinite(new Date(input.effectiveAt).getTime())) return "invalid_effective_at";
  // A physical count observes the present, so it may not be effective in the future.
  // Mirrors the reject_future_dated_inventory_count database trigger.
  if (
    input.eventType === "count" &&
    !isTemporallyValidCount(input.effectiveAt, recordedAt, COUNT_CLOCK_SKEW_TOLERANCE_MS)
  ) {
    return "future_dated_count";
  }
  // Far-past effective_at values (epoch bugs, absurd backdating) scramble ledger
  // ordering and projections. Mirrors reject_far_past_inventory_event (90 days).
  if (isFarPastEffectiveAt(input.effectiveAt, recordedAt)) {
    return "effective_at_too_old";
  }
  if (!Number.isFinite(input.quantity)) return "invalid_quantity";
  if (
    (input.eventType === "receipt" ||
      input.eventType === "count" ||
      input.eventType === "waste" ||
      input.eventType === "usage") &&
    input.quantity < 0
  ) {
    return "invalid_quantity";
  }
  if (input.eventType === "stockout" && input.quantity !== 0) return "invalid_stockout_quantity";
  return null;
}

function isFarPastEffectiveAt(
  effectiveAt: string,
  recordedAt: string,
  maxLookbackMs: number = INVENTORY_EVENT_EFFECTIVE_AT_MAX_LOOKBACK_MS
) {
  const effectiveMs = Date.parse(effectiveAt);
  const recordedMs = Date.parse(recordedAt);
  if (!Number.isFinite(effectiveMs) || !Number.isFinite(recordedMs)) return true;
  return effectiveMs < recordedMs - maxLookbackMs;
}

function sameEventPayload(event: InventoryEvent, candidate: InventoryEventInput) {
  return (
    event.restaurantId === candidate.restaurantId &&
    event.inventoryItemId === candidate.inventoryItemId &&
    event.eventType === candidate.eventType &&
    event.quantity === candidate.quantity &&
    event.canonicalUnit === candidate.canonicalUnit &&
    event.effectiveAt === candidate.effectiveAt &&
    event.source === candidate.source &&
    event.sourceReference === candidate.sourceReference &&
    event.reasonCode === candidate.reasonCode &&
    event.clientEventId === candidate.clientEventId &&
    event.idempotencyKey === candidate.idempotencyKey &&
    event.supersedesEventId === candidate.supersedesEventId &&
    JSON.stringify(event.metadata) === JSON.stringify(candidate.metadata)
  );
}

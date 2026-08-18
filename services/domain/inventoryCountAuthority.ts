/**
 * Authoritative physical-inventory evidence.
 *
 * `inventory_items.last_updated` moves for par/reorder policy edits, supplier
 * changes, cost changes, and other metadata mutations, so it can never prove
 * that a physical count happened. The only authoritative evidence is a `count`
 * row on the append-only inventory ledger (`inventory_events`), which is written
 * exclusively by audited count paths such as manager-approved count sessions.
 *
 * Temporal ordering rule (`COUNT_BOUNDARY_RULE`): a verified count observes the
 * shelf AT its own instant, so evidence whose effective instant equals the count
 * instant is already inside the counted quantity. Only strictly later evidence
 * (`effectiveAt > countedAt`) may move that baseline. That boundary is what stops
 * a midday count from being depleted a second time by the morning's sales.
 *
 * This module is intentionally dependency-free so the Expo client, the pure
 * domain tests, and the Deno Edge planning path can all share one rule set.
 */

/** Events exactly at the count instant are inside the baseline, never applied again. */
export const COUNT_BOUNDARY_RULE = "count_instant_included_in_baseline" as const;

/** Matches the pilot readiness contract's inventory-count staleness window. */
export const DEFAULT_MAXIMUM_COUNT_AGE_HOURS = 36;

/**
 * Temporal-validity rule for physical counts (`COUNT_VALIDITY_RULE`).
 *
 * A physical count is an observation of the present, so a count effective in the
 * future is not evidence of anything and is rejected outright — it is never aged
 * to zero, never treated as fresh, and never allowed to hide an older valid count.
 *
 * The tolerance exists for one specific reason: `effective_at` on a count recorded
 * from a device is stamped from that device's clock, while the instant we evaluate
 * against comes from the reading process's clock. An NTP-synced device is within
 * seconds; two minutes absorbs unsynced drift without admitting a materially
 * future-dated count. The same two-minute bound is applied in
 * `private.fetch_operational_planning_snapshot` and in the
 * `reject_future_dated_inventory_count` ledger trigger, so the client, the Edge
 * planning path, and the database agree on which counts exist.
 */
export const COUNT_VALIDITY_RULE = "reject_counts_effective_after_evaluation_instant" as const;
export const COUNT_CLOCK_SKEW_TOLERANCE_MS = 120_000;

/**
 * Contamination rule for the materialized on-hand projection
 * (`PROJECTION_CONTAMINATION_RULE`).
 *
 * `private.apply_inventory_event_projection` is an AFTER INSERT trigger that applies
 * events in ledger `sequence` (insertion) order, and a `count` event *replaces*
 * `inventory_items.current_quantity` rather than adjusting it. So the materialized
 * value is anchored by the highest-sequence `count` row for that item, plus the
 * non-count deltas inserted after it.
 *
 * A future-dated count inserted before the `reject_future_dated_inventory_count`
 * trigger existed therefore may already have overwritten `current_quantity`. Ignoring
 * it as *evidence* is not enough: `calculateOperationalSignals` still starts from
 * `current_quantity` as its numeric on-hand basis.
 *
 * The projection is contaminated exactly when the item's highest-sequence count is
 * temporally invalid. If a valid count was inserted after it, the trigger re-anchored
 * `current_quantity` to that valid count and only valid deltas followed, so the item
 * is trustworthy again — which is why a legitimate recount restores readiness without
 * any repair, deletion, or fabricated count.
 *
 * Mise fails closed rather than rebuilding the projection because the ledger is not a
 * complete history: setup writes `current_quantity` directly (ledger authority begins
 * "after the first ledger event"), and `canonical_quantity_per_unit` is mutable, so
 * replaying historical canonical quantities with today's factor is not provably
 * faithful.
 */
/**
 * Contamination has two causes, both of which come from the projection applying
 * events in insertion order while authority is defined by effective time:
 *
 *   1. the highest-sequence count is future-dated, so the anchor itself is invalid;
 *   2. a row inserted after that anchor was effective at or before it, so the old
 *      trigger applied something the count had already observed — a delayed offline
 *      receipt, waste, usage, stockout, adjustment, transfer, or correction, or a
 *      backdated count that clobbered newer physical evidence.
 *
 * Either way the materialized quantity is untrustworthy and the item must not drive
 * quantity-based output until a real recount re-anchors it.
 */
export const PROJECTION_CONTAMINATION_RULE =
  "materialized_quantity_must_follow_the_count_boundary" as const;

/**
 * `contaminated` means the item's materialized on-hand projection
 * (`inventory_items.current_quantity`) was last anchored by an invalid future-dated
 * count, so the number itself cannot be trusted — see `PROJECTION_CONTAMINATION_RULE`.
 */
export type InventoryCountEvidenceStatus = "verified" | "missing" | "contaminated";
export type InventoryCountFreshness = "fresh" | "stale" | "unverified";
export type AuthoritativeInventoryEvidence = "verified_count" | "no_verified_count";

/**
 * Minimal structural shape shared by the normalized repository ledger row and the
 * `service_fetch_operational_planning_snapshot` payload. `eventType` is optional so
 * an already-filtered count list is accepted, but any non-count row is ignored.
 */
export interface VerifiedCountCandidate {
  restaurantId: string;
  inventoryItemId: string;
  effectiveAt: string;
  eventType?: string;
  sequence?: number;
  quantity?: number;
  id?: string;
}

export interface VerifiedInventoryCount {
  restaurantId: string;
  inventoryItemId: string;
  /** Authoritative instant the physical quantity was observed. */
  countedAt: string;
  sequence: number;
  /** Ledger quantity in canonical units (g/ml/each), when the source carried one. */
  canonicalQuantity: number | null;
  /** Counted quantity converted back into the item's native unit, when convertible. */
  countedQuantity: number | null;
  eventId: string | null;
}

export interface InventoryCountEvidence {
  restaurantId: string;
  inventoryItemId: string;
  status: InventoryCountEvidenceStatus;
  count: VerifiedInventoryCount | null;
  countedAt: string | null;
  /** Operating date (restaurant-local) that contains `countedAt`. */
  countedOperatingDate: string | null;
  countAgeHours: number | null;
  freshness: InventoryCountFreshness;
}

export type InventoryCountEvidenceMap = ReadonlyMap<string, InventoryCountEvidence>;

/**
 * A consumption entry that may deplete a counted baseline.
 *
 * `instant` carries a real occurrence time (ledger usage/waste evidence).
 * `operating_day` carries only a date, which is all a `pos_sales` row records.
 * Day-resolution consumption cannot be ordered against a count taken inside the
 * same operating day, so it is reported as unattributed instead of guessed at.
 */
export interface AuthoritativeConsumptionEntry {
  restaurantId: string;
  inventoryItemId: string;
  quantity: number;
  resolution: "instant" | "operating_day";
  occurredAt?: string;
  operatingDate?: string;
}

/**
 * Any ledger row, count or not, in the minimal shape needed to judge whether the
 * materialized projection followed the count boundary.
 */
export interface LedgerProjectionEvent {
  restaurantId: string;
  inventoryItemId: string;
  eventType?: string;
  effectiveAt: string;
  sequence?: number;
  /**
   * Whether this row moved `inventory_items.current_quantity`. Absent means applied,
   * which is how every pre-boundary-fix row must be read.
   */
  projectionApplied?: boolean;
}

/** A signed native-unit ledger movement, already recorded against the item. */
export interface AuthoritativeLedgerMovement {
  restaurantId: string;
  inventoryItemId: string;
  effectiveAt: string;
  quantityDelta: number;
}

export interface AuthoritativeOnHandInput {
  restaurantId: string;
  inventoryItemId: string;
  evidence: InventoryCountEvidence;
  movements?: readonly AuthoritativeLedgerMovement[];
  consumption?: readonly AuthoritativeConsumptionEntry[];
  /**
   * Evaluation instant. Evidence effective after it (beyond clock-skew tolerance)
   * is not yet an observation and is ignored, so a future receipt cannot inflate
   * projected stock the way a future count could inflate freshness.
   */
  asOf?: string;
  clockSkewToleranceMs?: number;
}

export interface AuthoritativeOnHandProjection {
  restaurantId: string;
  inventoryItemId: string;
  evidence: AuthoritativeInventoryEvidence;
  countedAt: string | null;
  baselineQuantity: number | null;
  /** Ledger additions applied strictly after the count. */
  appliedAdditions: number;
  /** Ledger reductions applied strictly after the count. */
  appliedLedgerReductions: number;
  /** Mapped consumption applied strictly after the count. */
  appliedConsumption: number;
  /** Consumption that cannot be ordered against the count and was therefore not applied. */
  unattributedConsumption: number;
  projectedQuantity: number | null;
  countAgeHours: number | null;
  freshness: InventoryCountFreshness;
  /**
   * False whenever Mise cannot fully anchor the projection: no verified count, or
   * consumption whose timing cannot be ordered against the count. Callers must
   * treat this as not-ready rather than presenting a precise projection.
   */
  isTemporallyAuthoritative: boolean;
}

/**
 * True when a count's effective instant is a valid observation of the present.
 * Anything beyond the clock-skew tolerance is future-dated and therefore invalid.
 */
export function isTemporallyValidCount(
  effectiveAt: string | null | undefined,
  asOf: string,
  clockSkewToleranceMs: number = COUNT_CLOCK_SKEW_TOLERANCE_MS
): boolean {
  if (!effectiveAt) return false;
  const effective = Date.parse(effectiveAt);
  const evaluated = Date.parse(asOf);
  if (!Number.isFinite(effective) || !Number.isFinite(evaluated)) return false;
  return effective <= evaluated + boundedTolerance(clockSkewToleranceMs);
}

/**
 * Resolves the newest *valid* verified physical count for one tenant-scoped item.
 *
 * Future-dated candidates are discarded before the newest-wins comparison, so an
 * invalid future count can never hide the latest valid count for that item.
 */
export function resolveVerifiedInventoryCount(
  restaurantId: string,
  inventoryItemId: string,
  candidates: readonly VerifiedCountCandidate[],
  canonicalQuantityPerUnit?: number | null,
  options: { asOf?: string; clockSkewToleranceMs?: number } = {}
): VerifiedInventoryCount | null {
  let newest: VerifiedInventoryCount | null = null;
  let newestTimestamp = Number.NEGATIVE_INFINITY;
  // Fail closed: with no explicit evaluation instant, judge against real time.
  const asOf = options.asOf ?? new Date().toISOString();

  for (const candidate of candidates) {
    if (candidate.restaurantId !== restaurantId) continue;
    if (candidate.inventoryItemId !== inventoryItemId) continue;
    if (candidate.eventType !== undefined && candidate.eventType !== "count") continue;
    const timestamp = Date.parse(candidate.effectiveAt);
    if (!Number.isFinite(timestamp)) continue;
    if (!isTemporallyValidCount(candidate.effectiveAt, asOf, options.clockSkewToleranceMs)) continue;
    const sequence = Number.isFinite(candidate.sequence) ? Number(candidate.sequence) : 0;
    if (
      newest &&
      (timestamp < newestTimestamp || (timestamp === newestTimestamp && sequence <= newest.sequence))
    ) {
      continue;
    }
    const canonicalQuantity = Number.isFinite(candidate.quantity) ? Number(candidate.quantity) : null;
    newest = {
      restaurantId,
      inventoryItemId,
      countedAt: new Date(timestamp).toISOString(),
      sequence,
      canonicalQuantity,
      countedQuantity: nativeCountedQuantity(canonicalQuantity, canonicalQuantityPerUnit),
      eventId: typeof candidate.id === "string" && candidate.id ? candidate.id : null
    };
    newestTimestamp = timestamp;
  }

  return newest;
}

/**
 * `PROJECTION_CONTAMINATION_RULE`: true when `inventory_items.current_quantity` for
 * this item may not reflect the count boundary.
 *
 * `ledgerComplete` must be false when the caller's bounded ledger read was truncated;
 * ordering integrity then cannot be proven and the item fails closed.
 */
export function projectionContaminated(
  restaurantId: string,
  inventoryItemId: string,
  ledgerEvents: readonly LedgerProjectionEvent[],
  options: { asOf?: string; clockSkewToleranceMs?: number; ledgerComplete?: boolean } = {}
): boolean {
  const asOf = options.asOf ?? new Date().toISOString();
  const clockSkewToleranceMs = boundedTolerance(options.clockSkewToleranceMs);
  const scoped = ledgerEvents.filter(
    (event) =>
      event.restaurantId === restaurantId &&
      event.inventoryItemId === inventoryItemId &&
      Number.isFinite(Date.parse(event.effectiveAt))
  );

  // The anchor is the highest-sequence count: a count replaces the materialized
  // quantity, and the projection applies rows in insertion order.
  let anchor: LedgerProjectionEvent | null = null;
  let anchorSequence = Number.NEGATIVE_INFINITY;
  let anchorInvalidAtTopSequence = false;
  for (const event of scoped) {
    if (event.eventType !== undefined && event.eventType !== "count") continue;
    const sequence = ledgerSequence(event);
    const invalid = !isTemporallyValidCount(event.effectiveAt, asOf, clockSkewToleranceMs);
    if (sequence > anchorSequence) {
      anchor = event;
      anchorSequence = sequence;
      anchorInvalidAtTopSequence = invalid;
      continue;
    }
    // Sequence tie: fail closed, an invalid row at the top sequence contaminates.
    if (sequence === anchorSequence && invalid) anchorInvalidAtTopSequence = true;
  }

  if (!anchor) return false;
  if (anchorInvalidAtTopSequence) return true;
  if (options.ledgerComplete === false) return true;

  const anchorEffective = Date.parse(anchor.effectiveAt);
  for (const event of scoped) {
    const isCount = event.eventType === undefined || event.eventType === "count";
    const effective = Date.parse(event.effectiveAt);
    if (isCount) {
      // A valid count with newer physical evidence but a lower sequence means the
      // anchor was applied out of order and clobbered it.
      if (
        anchor.projectionApplied !== false &&
        effective > anchorEffective &&
        ledgerSequence(event) < anchorSequence &&
        isTemporallyValidCount(event.effectiveAt, asOf, clockSkewToleranceMs)
      ) {
        return true;
      }
      continue;
    }
    // A non-count row inserted after the anchor but effective at or before it was
    // already inside the counted baseline. Only rows that actually moved the
    // projection contaminate it: the boundary fix retains later ones without
    // applying them, and those are harmless.
    if (
      event.projectionApplied !== false &&
      ledgerSequence(event) > anchorSequence &&
      effective <= anchorEffective
    ) {
      return true;
    }
  }

  return false;
}

function ledgerSequence(event: LedgerProjectionEvent) {
  return Number.isFinite(event.sequence) ? Number(event.sequence) : 0;
}

/** Evidence for an item whose materialized projection no longer follows the count boundary. */
export function contaminatedInventoryCountEvidence(
  restaurantId: string,
  inventoryItemId: string
): InventoryCountEvidence {
  return {
    restaurantId,
    inventoryItemId,
    status: "contaminated",
    count: null,
    countedAt: null,
    countedOperatingDate: null,
    countAgeHours: null,
    freshness: "unverified"
  };
}

/**
 * Builds per-item count evidence for one restaurant.
 *
 * `resolveOperatingDate` lets the caller supply restaurant-local day keys without
 * pulling a timezone dependency into the domain layer. It defaults to the UTC day.
 */
export function buildInventoryCountEvidence(input: {
  restaurantId: string;
  items: readonly { id: string; canonical_quantity_per_unit?: number | null }[];
  /**
   * Ledger rows for the restaurant. Count rows supply the authoritative baseline;
   * non-count rows are needed to prove the materialized quantity followed the count
   * boundary, so passing counts alone cannot detect an out-of-order projection.
   */
  ledgerEvents: readonly LedgerProjectionEvent[];
  /**
   * False when the caller's bounded ledger read was truncated. Ordering integrity
   * cannot be proven from a partial ledger, so counted items then fail closed.
   */
  ledgerComplete?: boolean;
  generatedAt?: string;
  maximumCountAgeHours?: number;
  clockSkewToleranceMs?: number;
  resolveOperatingDate?: (iso: string) => string;
}): Map<string, InventoryCountEvidence> {
  const restaurantId = input.restaurantId.trim();
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const maximumCountAgeHours = boundedAgeHours(input.maximumCountAgeHours);
  const clockSkewToleranceMs = boundedTolerance(input.clockSkewToleranceMs);
  const resolveOperatingDate = input.resolveOperatingDate ?? utcOperatingDate;
  const evidence = new Map<string, InventoryCountEvidence>();

  for (const item of input.items) {
    // A tainted materialized projection outranks any older valid count: the number
    // planning would start from is untrustworthy, so the item has no usable evidence
    // until a real recount re-anchors it.
    if (
      projectionContaminated(restaurantId, item.id, input.ledgerEvents, {
        asOf: generatedAt,
        clockSkewToleranceMs,
        ledgerComplete: input.ledgerComplete
      })
    ) {
      evidence.set(item.id, contaminatedInventoryCountEvidence(restaurantId, item.id));
      continue;
    }
    const count = resolveVerifiedInventoryCount(
      restaurantId,
      item.id,
      input.ledgerEvents,
      item.canonical_quantity_per_unit,
      { asOf: generatedAt, clockSkewToleranceMs }
    );
    evidence.set(
      item.id,
      countEvidenceFor(
        restaurantId,
        item.id,
        count,
        generatedAt,
        maximumCountAgeHours,
        clockSkewToleranceMs,
        resolveOperatingDate
      )
    );
  }

  return evidence;
}

/**
 * Adds the count evidence an in-flight count approval is about to persist.
 *
 * Signals recomputed inside the approval boundary must be anchored to the count
 * being approved, not the previous one, or the freshly counted quantity would be
 * depleted again by sales the counter already observed.
 */
export function withPendingCountEvidence(
  existing: readonly VerifiedCountCandidate[],
  pending: {
    restaurantId: string;
    inventoryItemIds: readonly string[];
    countedAt: string;
  }
): VerifiedCountCandidate[] {
  const maximumSequence = existing.reduce(
    (maximum, candidate) =>
      Number.isFinite(candidate.sequence) ? Math.max(maximum, Number(candidate.sequence)) : maximum,
    0
  );
  return [
    ...existing,
    ...pending.inventoryItemIds.map((inventoryItemId, index) => ({
      restaurantId: pending.restaurantId,
      inventoryItemId,
      effectiveAt: pending.countedAt,
      eventType: "count",
      sequence: maximumSequence + 1 + index
    }))
  ];
}

/** Evidence for an item Mise has no verified count for. */
export function missingInventoryCountEvidence(
  restaurantId: string,
  inventoryItemId: string
): InventoryCountEvidence {
  return {
    restaurantId,
    inventoryItemId,
    status: "missing",
    count: null,
    countedAt: null,
    countedOperatingDate: null,
    countAgeHours: null,
    freshness: "unverified"
  };
}

/** `COUNT_BOUNDARY_RULE`: only strictly-later evidence may move a counted baseline. */
export function isStrictlyAfterCount(countedAt: string | null, candidateIso: string | undefined): boolean {
  if (!countedAt || !candidateIso) return false;
  const counted = Date.parse(countedAt);
  const candidate = Date.parse(candidateIso);
  if (!Number.isFinite(counted) || !Number.isFinite(candidate)) return false;
  return candidate > counted;
}

/**
 * True when a verified physical count happened strictly after `sinceIso`.
 * Used to release recommendation suppression only on newer physical evidence.
 */
export function verifiedCountSupersedes(
  evidence: InventoryCountEvidence,
  sinceIso: string | null | undefined
): boolean {
  if (evidence.status !== "verified" || !sinceIso) return false;
  return isStrictlyAfterCount(sinceIso, evidence.countedAt ?? undefined);
}

/**
 * Decides whether day-resolution consumption for `operatingDate` can be proven to
 * have happened after the count. A count taken inside the same operating day
 * already observed part of that day, so same-day (or later-dated) counts make the
 * day's consumption unattributable rather than subtractable.
 */
export function dayResolutionConsumptionIsAfterCount(
  countedOperatingDate: string | null,
  operatingDate: string | undefined
): boolean {
  if (!countedOperatingDate || !operatingDate) return false;
  return operatingDate > countedOperatingDate;
}

/**
 * Projects on-hand inventory from authoritative evidence only:
 * verified counted quantity + additions after the count - consumption after the count.
 *
 * Returns `projectedQuantity: null` when there is no verified count, so callers
 * fail closed instead of presenting fabricated precision.
 */
export function projectAuthoritativeOnHand(
  input: AuthoritativeOnHandInput
): AuthoritativeOnHandProjection {
  const restaurantId = input.restaurantId;
  const inventoryItemId = input.inventoryItemId;
  const evidence = input.evidence;
  const asOf = input.asOf ?? new Date().toISOString();
  const clockSkewToleranceMs = boundedTolerance(input.clockSkewToleranceMs);
  const count = evidence.status === "verified" ? evidence.count : null;
  const baselineQuantity =
    count && Number.isFinite(count.countedQuantity) ? Number(count.countedQuantity) : null;

  let appliedAdditions = 0;
  let appliedLedgerReductions = 0;
  let appliedConsumption = 0;
  let unattributedConsumption = 0;

  for (const movement of input.movements ?? []) {
    if (movement.restaurantId !== restaurantId) continue;
    if (movement.inventoryItemId !== inventoryItemId) continue;
    if (!Number.isFinite(movement.quantityDelta)) continue;
    if (!isTemporallyValidCount(movement.effectiveAt, asOf, clockSkewToleranceMs)) continue;
    if (!isStrictlyAfterCount(evidence.countedAt, movement.effectiveAt)) continue;
    if (movement.quantityDelta >= 0) appliedAdditions += movement.quantityDelta;
    else appliedLedgerReductions += Math.abs(movement.quantityDelta);
  }

  for (const entry of input.consumption ?? []) {
    if (entry.restaurantId !== restaurantId) continue;
    if (entry.inventoryItemId !== inventoryItemId) continue;
    const quantity = Number.isFinite(entry.quantity) ? Math.max(0, entry.quantity) : 0;
    if (quantity === 0) continue;
    if (entry.resolution === "instant") {
      if (!isTemporallyValidCount(entry.occurredAt, asOf, clockSkewToleranceMs)) continue;
      if (isStrictlyAfterCount(evidence.countedAt, entry.occurredAt)) appliedConsumption += quantity;
      continue;
    }
    if (dayResolutionConsumptionIsAfterCount(evidence.countedOperatingDate, entry.operatingDate)) {
      appliedConsumption += quantity;
      continue;
    }
    if (entry.operatingDate && evidence.countedOperatingDate === entry.operatingDate) {
      unattributedConsumption += quantity;
    }
  }

  const projectedQuantity =
    baselineQuantity === null
      ? null
      : Math.max(
          0,
          baselineQuantity + appliedAdditions - appliedLedgerReductions - appliedConsumption
        );

  return {
    restaurantId,
    inventoryItemId,
    evidence: count ? "verified_count" : "no_verified_count",
    countedAt: evidence.countedAt,
    baselineQuantity,
    appliedAdditions,
    appliedLedgerReductions,
    appliedConsumption,
    unattributedConsumption,
    projectedQuantity,
    countAgeHours: evidence.countAgeHours,
    freshness: evidence.freshness,
    isTemporallyAuthoritative:
      Boolean(count) && projectedQuantity !== null && unattributedConsumption === 0
  };
}

function countEvidenceFor(
  restaurantId: string,
  inventoryItemId: string,
  count: VerifiedInventoryCount | null,
  generatedAt: string,
  maximumCountAgeHours: number,
  clockSkewToleranceMs: number,
  resolveOperatingDate: (iso: string) => string
): InventoryCountEvidence {
  if (!count) return missingInventoryCountEvidence(restaurantId, inventoryItemId);
  const countAgeHours = ageHours(count.countedAt, generatedAt, clockSkewToleranceMs);
  // Defensive: an unmeasurable age is never presented as a usable count.
  if (countAgeHours === null) return missingInventoryCountEvidence(restaurantId, inventoryItemId);
  return {
    restaurantId,
    inventoryItemId,
    status: "verified",
    count,
    countedAt: count.countedAt,
    countedOperatingDate: safeOperatingDate(count.countedAt, resolveOperatingDate),
    countAgeHours,
    freshness: countAgeHours > maximumCountAgeHours ? "stale" : "fresh"
  };
}

function nativeCountedQuantity(
  canonicalQuantity: number | null,
  canonicalQuantityPerUnit: number | null | undefined
) {
  if (canonicalQuantity === null || !Number.isFinite(canonicalQuantity)) return null;
  if (
    canonicalQuantityPerUnit === null ||
    canonicalQuantityPerUnit === undefined ||
    !Number.isFinite(canonicalQuantityPerUnit) ||
    canonicalQuantityPerUnit <= 0
  ) {
    return null;
  }
  return canonicalQuantity / canonicalQuantityPerUnit;
}

function safeOperatingDate(iso: string, resolveOperatingDate: (value: string) => string) {
  try {
    const resolved = resolveOperatingDate(iso);
    return /^\d{4}-\d{2}-\d{2}$/.test(resolved) ? resolved : utcOperatingDate(iso);
  } catch {
    return utcOperatingDate(iso);
  }
}

function utcOperatingDate(iso: string) {
  return iso.slice(0, 10);
}

function boundedAgeHours(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_MAXIMUM_COUNT_AGE_HOURS;
  return Math.min(24 * 30, Math.max(1, value));
}

/**
 * Age of an observation in hours.
 *
 * Returns null when the age cannot be measured, or when `then` is further in the
 * future than the clock-skew tolerance allows. Only drift inside the tolerance is
 * flattened to zero; a materially future timestamp is reported as unmeasurable so
 * callers fail closed instead of reading it as a brand-new observation.
 */
function ageHours(
  then: string,
  now: string,
  clockSkewToleranceMs: number = COUNT_CLOCK_SKEW_TOLERANCE_MS
) {
  const elapsed = Date.parse(now) - Date.parse(then);
  if (!Number.isFinite(elapsed)) return null;
  if (elapsed < -boundedTolerance(clockSkewToleranceMs)) return null;
  return Math.max(0, elapsed / 3_600_000);
}

function boundedTolerance(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return COUNT_CLOCK_SKEW_TOLERANCE_MS;
  return Math.min(COUNT_CLOCK_SKEW_TOLERANCE_MS, Math.max(0, value));
}

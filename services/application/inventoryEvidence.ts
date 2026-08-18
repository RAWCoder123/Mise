import type { InventoryItem } from "../../types/mise";
import type { InventoryEvent } from "../domain/inventoryLedger";
import {
  buildInventoryCountEvidence,
  type InventoryCountEvidenceMap,
  type LedgerProjectionEvent
} from "../domain/inventoryCountAuthority";
import { toDateKeyInTimeZone } from "../../utils/format";
import { getMiseRepository } from "./repository";

/**
 * Bounded read of authoritative physical-count evidence. Count sessions cap a
 * restaurant at 250 items, so this window always covers the newest count per item.
 */
export const VERIFIED_COUNT_EVENT_LIMIT = 2000;

/**
 * Bounded read of the non-count rows recorded after the oldest count anchor. These
 * prove whether the materialized on-hand projection followed the count boundary; a
 * truncated read cannot prove it, so the read reports its own completeness.
 */
export const LEDGER_ORDERING_EVENT_LIMIT = 2000;

const repository = getMiseRepository();

/** Ledger evidence for one restaurant, plus whether the bounded read was complete. */
export interface InventoryLedgerEvidence {
  events: InventoryEvent[];
  complete: boolean;
}

/**
 * Tenant-scoped ledger read for count authority.
 *
 * Counts prove a physical count happened. The rows recorded after the oldest count
 * anchor are also needed, because `apply_inventory_event_projection` historically
 * applied a later-inserted, earlier-effective row on top of a count, which can leave
 * `inventory_items.current_quantity` untrustworthy. Reading counts alone would make
 * that undetectable.
 */
export async function fetchInventoryLedgerEvidence(
  restaurantId: string
): Promise<InventoryLedgerEvidence> {
  const countEvents = await repository.listInventoryEvents(restaurantId, {
    eventTypes: ["count"],
    limit: VERIFIED_COUNT_EVENT_LIMIT
  });
  const countsComplete = countEvents.length < VERIFIED_COUNT_EVENT_LIMIT;
  if (countEvents.length === 0) {
    // No anchor exists, so no row can have been applied across a count boundary.
    return { events: countEvents, complete: countsComplete };
  }

  const oldestAnchorSequence = countEvents.reduce(
    (minimum, event) => Math.min(minimum, event.sequence),
    Number.POSITIVE_INFINITY
  );
  const followingEvents = await repository.listInventoryEvents(restaurantId, {
    sinceSequence: Number.isFinite(oldestAnchorSequence) ? oldestAnchorSequence - 1 : 0,
    limit: LEDGER_ORDERING_EVENT_LIMIT
  });
  const followingComplete = followingEvents.length < LEDGER_ORDERING_EVENT_LIMIT;

  const byId = new Map<string, InventoryEvent>();
  for (const event of [...countEvents, ...followingEvents]) byId.set(event.id, event);
  return {
    events: [...byId.values()],
    complete: countsComplete && followingComplete
  };
}

/** Count-only ledger read, for consumers that need freshness but not ordering proof. */
export async function fetchVerifiedInventoryCountEvents(restaurantId: string) {
  return repository.listInventoryEvents(restaurantId, {
    eventTypes: ["count"],
    limit: VERIFIED_COUNT_EVENT_LIMIT
  });
}

/**
 * Turns ledger evidence into per-item count evidence, placing each count inside the
 * restaurant's own operating day so a midday count is not depleted twice, and marking
 * items whose materialized quantity no longer follows the count boundary.
 */
export function inventoryCountEvidenceFor(input: {
  restaurantId: string;
  inventoryItems: readonly InventoryItem[];
  ledgerEvents: readonly LedgerProjectionEvent[];
  ledgerComplete?: boolean;
  timeZone?: string | null;
  generatedAt?: string;
}): InventoryCountEvidenceMap {
  const timeZone = input.timeZone;
  return buildInventoryCountEvidence({
    restaurantId: input.restaurantId,
    items: input.inventoryItems.filter((item) => item.restaurant_id === input.restaurantId),
    ledgerEvents: input.ledgerEvents,
    ledgerComplete: input.ledgerComplete,
    generatedAt: input.generatedAt,
    resolveOperatingDate: timeZone
      ? (iso) => toDateKeyInTimeZone(new Date(iso), timeZone)
      : undefined
  });
}

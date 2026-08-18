import type { InventoryItem } from "../../types/mise";
import type { InventoryEvent } from "../domain/inventoryLedger";
import {
  buildInventoryCountEvidence,
  type InventoryCountEvidenceMap
} from "../domain/inventoryCountAuthority";
import { toDateKeyInTimeZone } from "../../utils/format";
import { getMiseRepository } from "./repository";

/**
 * Bounded read of authoritative physical-count evidence. Count sessions cap a
 * restaurant at 250 items, so this window always covers the newest count per item.
 */
export const VERIFIED_COUNT_EVENT_LIMIT = 2000;

const repository = getMiseRepository();

/** Tenant-scoped ledger read of `count` events, the only proof a physical count happened. */
export async function fetchVerifiedInventoryCountEvents(restaurantId: string) {
  return repository.listInventoryEvents(restaurantId, {
    eventTypes: ["count"],
    limit: VERIFIED_COUNT_EVENT_LIMIT
  });
}

/**
 * Turns ledger count events into per-item evidence, placing each count inside the
 * restaurant's own operating day so a midday count is not depleted twice.
 */
export function inventoryCountEvidenceFor(input: {
  restaurantId: string;
  inventoryItems: readonly InventoryItem[];
  countEvents: readonly InventoryEvent[];
  timeZone?: string | null;
  generatedAt?: string;
}): InventoryCountEvidenceMap {
  const timeZone = input.timeZone;
  return buildInventoryCountEvidence({
    restaurantId: input.restaurantId,
    items: input.inventoryItems.filter((item) => item.restaurant_id === input.restaurantId),
    countEvents: input.countEvents,
    generatedAt: input.generatedAt,
    resolveOperatingDate: timeZone
      ? (iso) => toDateKeyInTimeZone(new Date(iso), timeZone)
      : undefined
  });
}

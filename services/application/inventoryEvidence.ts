import type { InventoryItem } from "../../types/mise";
import type { InventoryEvent, InventoryEventType } from "../domain/inventoryLedger";
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

/** Newest-first window for the restaurant-wide movements browser. */
export const RESTAURANT_MOVEMENTS_LIMIT = 80;

export type InventoryMovementFeedFilter =
  | "all"
  | "count"
  | "receipt"
  | "waste"
  | "usage"
  | "adjustment"
  | "transfer"
  | "stockout";

export const INVENTORY_MOVEMENT_FEED_FILTERS = [
  "all",
  "count",
  "receipt",
  "waste",
  "usage",
  "adjustment",
  "transfer",
  "stockout"
] as const satisfies readonly InventoryMovementFeedFilter[];

export interface RestaurantInventoryMovementRow {
  event: InventoryEvent;
  /** Current item display name, or null when the item is no longer present. */
  itemName: string | null;
}

export interface RestaurantInventoryMovementsResult {
  restaurantId: string;
  filter: InventoryMovementFeedFilter;
  movements: RestaurantInventoryMovementRow[];
  truncated: boolean;
}

/** Maps a movements-browser filter onto ledger event types (undefined = no filter). */
export function inventoryEventTypesForMovementFilter(
  filter: InventoryMovementFeedFilter
): InventoryEventType[] | undefined {
  if (filter === "all") return undefined;
  if (filter === "adjustment") return ["adjustment", "correction"];
  return [filter];
}

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
 * Restaurant-wide append-only inventory movements for the More browser.
 * Newest recorded rows first. Truncation is reported so the UI never pretends
 * the window is complete. Item names are joined from the current catalog only.
 */
export async function fetchRestaurantInventoryMovements(
  restaurantId: string,
  options: {
    filter?: InventoryMovementFeedFilter;
    limit?: number;
    since?: string;
  } = {}
): Promise<RestaurantInventoryMovementsResult> {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");

  const filter = options.filter ?? "all";
  const limit =
    options.limit != null && Number.isFinite(options.limit) && options.limit >= 0
      ? Math.floor(options.limit)
      : RESTAURANT_MOVEMENTS_LIMIT;
  const eventTypes = inventoryEventTypesForMovementFilter(filter);
  const since =
    typeof options.since === "string" && options.since.trim()
      ? options.since.trim()
      : undefined;

  const repositoryClient = getMiseRepository();
  const [events, inventoryItems] = await Promise.all([
    repositoryClient.listInventoryEvents(normalizedRestaurantId, {
      eventTypes,
      since,
      limit
    }),
    repositoryClient.fetchInventoryItems(normalizedRestaurantId)
  ]);

  const namesById = new Map(
    inventoryItems
      .filter((item) => item.restaurant_id === normalizedRestaurantId)
      .map((item) => [item.id, item.item_name] as const)
  );

  const scoped = events.filter((event) => event.restaurantId === normalizedRestaurantId);
  return {
    restaurantId: normalizedRestaurantId,
    filter,
    movements: scoped.map((event) => ({
      event,
      itemName: namesById.get(event.inventoryItemId) ?? null
    })),
    truncated: scoped.length === limit && limit > 0
  };
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

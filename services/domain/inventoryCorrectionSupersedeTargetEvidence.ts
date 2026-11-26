/**
 * Structural audit evidence for inventory correction supersession identity.
 *
 * `inventory_events.supersedes_event_id` names the prior ledger row a
 * correction claims to repair. Hosted `record_inventory_event` already
 * requires the named id to exist under the same `restaurant_id` and
 * `inventory_item_id`. Soft CHECKs only require `event_type = 'correction'`
 * when a supersedes id is present, and the FK is a bare
 * `references inventory_events(id)` without restaurant or item identity.
 *
 * On current main, every other insert path (including direct service_role
 * inserts that satisfy those soft CHECKs) can stamp `supersedes_event_id`
 * onto an event for a different inventory item inside the same restaurant,
 * or onto an event that belongs to another restaurant. Projection then
 * applies the forged correction delta under the wrong item while Activity /
 * waste-repair analysis treat the foreign id as durable repair evidence.
 *
 * Domain `acceptInventoryEvent` already rejects mismatched targets as
 * `superseded_event_not_found`. This tip couples the database boundary to
 * the same identity the RPC and domain already require. It does not require
 * supersedes to be present (orphan corrections remain #394), rewrite
 * `record_inventory_event`, or change exact-reverse quantity contracts (#395).
 */

export type InventoryCorrectionSupersedeTargetSnapshot = {
  restaurantId: string;
  inventoryItemId: string;
};

export type InventoryCorrectionSupersedeTargetEvidence = {
  supersedesEventId: string | null | undefined;
  restaurantId: string;
  inventoryItemId: string;
  /** Null when the named target cannot be loaded. */
  target: InventoryCorrectionSupersedeTargetSnapshot | null;
};

/**
 * Domain rejection reason when a correction forges supersession identity.
 * Returns null when `supersedesEventId` is absent, or when the target shares
 * restaurant and inventory-item identity with the correction.
 */
export function validateInventoryCorrectionSupersedeTargetEvidence(
  input: InventoryCorrectionSupersedeTargetEvidence
): string | null {
  if (input.supersedesEventId == null || input.supersedesEventId === "") {
    return null;
  }

  if (input.target == null) {
    return "supersede_target_missing";
  }

  if (input.target.restaurantId !== input.restaurantId) {
    return "supersede_target_restaurant_mismatch";
  }

  if (input.target.inventoryItemId !== input.inventoryItemId) {
    return "supersede_target_item_mismatch";
  }

  return null;
}

import {
  buildPurchaseLineLinkCandidates,
  requirePurchaseLineItemKey,
  suggestInventoryItemsForPurchaseLineKey
} from "../domain/purchaseLineItemLinks";
import type { InventoryItem } from "../../types/mise";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

function requireRestaurantId(restaurantId: string) {
  const normalized = restaurantId.trim();
  if (!normalized) throw new Error("Missing restaurant workspace.");
  return normalized;
}

function requireId(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Missing ${label}.`);
  return normalized;
}

export async function fetchPurchaseLineItemLinks(restaurantId: string) {
  return repository.fetchPurchaseLineItemLinks(requireRestaurantId(restaurantId));
}

export async function fetchPurchaseLineLinkCandidates(restaurantId: string) {
  const scopedRestaurantId = requireRestaurantId(restaurantId);
  const [lines, links] = await Promise.all([
    repository.fetchPurchaseLines(scopedRestaurantId),
    repository.fetchPurchaseLineItemLinks(scopedRestaurantId)
  ]);
  return buildPurchaseLineLinkCandidates(lines, links);
}

export async function linkPurchaseLineItem(input: {
  restaurantId: string;
  normalizedItemKey: string;
  inventoryItemId: string;
  supplierId?: string | null;
}) {
  return repository.linkPurchaseLineItem({
    restaurantId: requireRestaurantId(input.restaurantId),
    normalizedItemKey: requirePurchaseLineItemKey(input.normalizedItemKey),
    inventoryItemId: requireId(input.inventoryItemId, "inventory item"),
    supplierId: input.supplierId ?? null
  });
}

export async function revokePurchaseLineItemLink(restaurantId: string, linkId: string) {
  return repository.revokePurchaseLineItemLink(
    requireRestaurantId(restaurantId),
    requireId(linkId, "purchase line item link")
  );
}

export async function applyPurchaseLineLinkedUnitCost(restaurantId: string, linkId: string) {
  return repository.applyPurchaseLineLinkedUnitCost(
    requireRestaurantId(restaurantId),
    requireId(linkId, "purchase line item link")
  );
}

export function suggestInventoryMatchesForPurchaseLineKey(
  normalizedItemKey: string,
  items: readonly InventoryItem[]
) {
  return suggestInventoryItemsForPurchaseLineKey(normalizedItemKey, items);
}

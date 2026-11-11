import {
  buildPurchaseLineAliasCandidates,
  requirePurchaseLineItemKey
} from "../domain/purchaseLineItemKeyAliases";
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

export async function fetchPurchaseLineItemKeyAliases(restaurantId: string) {
  return repository.fetchPurchaseLineItemKeyAliases(requireRestaurantId(restaurantId));
}

export async function fetchPurchaseLineAliasCandidates(restaurantId: string) {
  const scopedRestaurantId = requireRestaurantId(restaurantId);
  const [lines, aliases] = await Promise.all([
    repository.fetchPurchaseLines(scopedRestaurantId),
    repository.fetchPurchaseLineItemKeyAliases(scopedRestaurantId)
  ]);
  return buildPurchaseLineAliasCandidates(lines, aliases);
}

export async function aliasPurchaseLineItemKey(input: {
  restaurantId: string;
  aliasItemKey: string;
  canonicalItemKey: string;
  supplierId?: string | null;
}) {
  const aliasItemKey = requirePurchaseLineItemKey(input.aliasItemKey);
  const canonicalItemKey = requirePurchaseLineItemKey(input.canonicalItemKey);
  if (aliasItemKey === canonicalItemKey) {
    throw new Error("Alias and canonical purchase item keys must differ.");
  }
  return repository.aliasPurchaseLineItemKey({
    restaurantId: requireRestaurantId(input.restaurantId),
    aliasItemKey,
    canonicalItemKey,
    supplierId: input.supplierId ?? null
  });
}

export async function revokePurchaseLineItemKeyAlias(restaurantId: string, aliasId: string) {
  return repository.revokePurchaseLineItemKeyAlias(
    requireRestaurantId(restaurantId),
    requireId(aliasId, "purchase line item key alias")
  );
}

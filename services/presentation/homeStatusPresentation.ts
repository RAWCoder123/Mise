/**
 * Resolves where Home's RestaurantStatusCard should navigate when pressed.
 *
 * The card title prefers a low-stock menu risk over an approval card. The href
 * must follow that same precedence so operators land on the workflow named in
 * the headline, not Orders/Today by default. When the leading menu risk carries
 * a durable inventory item id, deep-link into that item; otherwise open the
 * Inventory hub.
 */

export type RestaurantStatusCardHref =
  | `/inventory/${string}`
  | "/inventory"
  | "/orders"
  | "/today";

const UNSAFE_ID = /[/?#\s]/;

export function resolveRestaurantStatusCardHref(input: {
  primaryMenuRiskItemId?: string | null;
  hasPrimaryMenuRisk: boolean;
  hasPrimaryApproval: boolean;
}): RestaurantStatusCardHref {
  if (input.hasPrimaryMenuRisk) {
    const itemId =
      typeof input.primaryMenuRiskItemId === "string" ? input.primaryMenuRiskItemId.trim() : "";
    if (itemId && !UNSAFE_ID.test(itemId)) {
      return `/inventory/${itemId}`;
    }
    return "/inventory";
  }
  if (input.hasPrimaryApproval) {
    return "/orders";
  }
  return "/today";
}

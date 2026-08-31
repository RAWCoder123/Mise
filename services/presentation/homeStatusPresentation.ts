/**
 * Resolves where Home's RestaurantStatusCard should navigate when pressed.
 *
 * The card title prefers a low-stock menu risk over an approval card. The href
 * must follow that same precedence so operators land on the workflow named in
 * the headline, not Orders/Today by default.
 */
export type RestaurantStatusCardHref = "/inventory" | "/orders" | "/today";

export function resolveRestaurantStatusCardHref(input: {
  hasPrimaryMenuRisk: boolean;
  hasPrimaryApproval: boolean;
}): RestaurantStatusCardHref {
  if (input.hasPrimaryMenuRisk) {
    return "/inventory";
  }
  if (input.hasPrimaryApproval) {
    return "/orders";
  }
  return "/today";
}

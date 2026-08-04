import type { Restaurant, RestaurantMembership } from "../../types/mise";

export type RestaurantFetchSettlement =
  | { restaurantId: string; status: "fulfilled"; restaurant: Restaurant }
  | { restaurantId: string; status: "rejected"; error: unknown };

export class PreferredWorkspaceHydrationError extends Error {
  readonly restaurantId: string;

  constructor(restaurantId: string, cause?: unknown) {
    super("Could not load the active restaurant workspace.");
    this.name = "PreferredWorkspaceHydrationError";
    this.restaurantId = restaurantId;
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

export class EmptyWorkspaceHydrationError extends Error {
  constructor() {
    super("Could not load any restaurant workspaces for this account.");
    this.name = "EmptyWorkspaceHydrationError";
  }
}

function activeMembershipForRestaurantId(
  memberships: RestaurantMembership[],
  restaurantId: string | null | undefined
) {
  if (!restaurantId) return null;
  return (
    memberships.find(
      (membership) => membership.restaurant_id === restaurantId && membership.status === "active"
    ) ?? null
  );
}

export function settleMembershipRestaurantFetches(
  memberships: RestaurantMembership[],
  results: PromiseSettledResult<Restaurant>[]
): RestaurantFetchSettlement[] {
  return memberships.map((membership, index) => {
    const result = results[index];
    if (result?.status === "fulfilled") {
      return {
        restaurantId: membership.restaurant_id,
        status: "fulfilled" as const,
        restaurant: result.value
      };
    }
    return {
      restaurantId: membership.restaurant_id,
      status: "rejected" as const,
      error: result?.status === "rejected" ? result.reason : new Error("Restaurant fetch did not settle")
    };
  });
}

export function resolveMultiMembershipHydration(input: {
  memberships: RestaurantMembership[];
  settlements: RestaurantFetchSettlement[];
  preferredRestaurantId?: string | null;
}): {
  availableRestaurants: Restaurant[];
  loadableMemberships: RestaurantMembership[];
  droppedRestaurantIds: string[];
  droppedErrors: unknown[];
  activeMembership: RestaurantMembership;
  activeRestaurant: Restaurant;
} {
  const restaurantsById = new Map<string, Restaurant>();
  const droppedRestaurantIds: string[] = [];
  const droppedErrors: unknown[] = [];

  for (const settlement of input.settlements) {
    if (settlement.status === "fulfilled") {
      // Defense in depth: archived restaurants must not enter the workspace switcher
      // even if a stale membership row still points at them.
      if (settlement.restaurant.archived_at) {
        droppedRestaurantIds.push(settlement.restaurantId);
        droppedErrors.push(new Error("Restaurant workspace is archived"));
        continue;
      }
      restaurantsById.set(settlement.restaurantId, settlement.restaurant);
    } else {
      droppedRestaurantIds.push(settlement.restaurantId);
      droppedErrors.push(settlement.error);
    }
  }

  const availableRestaurants = input.memberships
    .map((membership) => restaurantsById.get(membership.restaurant_id))
    .filter((restaurant): restaurant is Restaurant => Boolean(restaurant))
    .filter((restaurant, index, list) => list.findIndex((entry) => entry.id === restaurant.id) === index);

  const loadableMemberships = input.memberships.filter((membership) =>
    restaurantsById.has(membership.restaurant_id)
  );

  const preferredMembership = activeMembershipForRestaurantId(
    input.memberships,
    input.preferredRestaurantId
  );

  if (preferredMembership) {
    const preferredRestaurant = restaurantsById.get(preferredMembership.restaurant_id);
    if (!preferredRestaurant) {
      const failedIndex = droppedRestaurantIds.indexOf(preferredMembership.restaurant_id);
      throw new PreferredWorkspaceHydrationError(
        preferredMembership.restaurant_id,
        failedIndex >= 0 ? droppedErrors[failedIndex] : undefined
      );
    }
    return {
      availableRestaurants,
      loadableMemberships,
      droppedRestaurantIds,
      droppedErrors,
      activeMembership: preferredMembership,
      activeRestaurant: preferredRestaurant
    };
  }

  const activeMembership =
    loadableMemberships.find((membership) => restaurantsById.has(membership.restaurant_id)) ?? null;
  const activeRestaurant = activeMembership
    ? restaurantsById.get(activeMembership.restaurant_id) ?? null
    : null;

  if (!activeMembership || !activeRestaurant) {
    throw new EmptyWorkspaceHydrationError();
  }

  return {
    availableRestaurants,
    loadableMemberships,
    droppedRestaurantIds,
    droppedErrors,
    activeMembership,
    activeRestaurant
  };
}

export type AccountDeletionMembershipSnapshot = {
  id: string;
  restaurant_id: string;
  user_id: string;
  role: string;
  status: string;
};

export function isConfirmedAccountDeletion(confirmation: string | null | undefined): boolean {
  return typeof confirmation === "string" && confirmation.trim().toUpperCase() === "DELETE";
}

export function selectSoleOwnedRestaurantIds(
  actorUserId: string,
  memberships: AccountDeletionMembershipSnapshot[]
): string[] {
  const active = memberships.filter((membership) => membership.status === "active");
  const actorOwnerRestaurantIds = active
    .filter((membership) => membership.user_id === actorUserId && membership.role === "owner")
    .map((membership) => membership.restaurant_id);

  const uniqueOwnerRestaurants = [...new Set(actorOwnerRestaurantIds)].sort();
  return uniqueOwnerRestaurants.filter((restaurantId) => {
    const otherActiveOwners = active.filter(
      (membership) =>
        membership.restaurant_id === restaurantId
        && membership.user_id !== actorUserId
        && membership.role === "owner"
    );
    return otherActiveOwners.length === 0;
  });
}

export function selectMembershipIdsDisabledByAccountDeletion(
  actorUserId: string,
  memberships: AccountDeletionMembershipSnapshot[],
  soleOwnedRestaurantIds: string[]
): string[] {
  const soleOwned = new Set(soleOwnedRestaurantIds);
  return memberships
    .filter((membership) => membership.status === "active")
    .filter(
      (membership) =>
        membership.user_id === actorUserId || soleOwned.has(membership.restaurant_id)
    )
    .map((membership) => membership.id)
    .sort();
}

export function buildAccountDeletionRequestMetadata(input: {
  soleOwnedRestaurantIds: string[];
  disabledMembershipIds: string[];
  archivedRestaurantCount?: number;
}): Record<string, unknown> {
  return {
    source: "request_my_account_deletion",
    archived_restaurant_ids: [...input.soleOwnedRestaurantIds].sort(),
    archived_restaurant_count:
      input.archivedRestaurantCount ?? input.soleOwnedRestaurantIds.length,
    disabled_membership_ids: [...input.disabledMembershipIds].sort(),
    disabled_membership_count: input.disabledMembershipIds.length
  };
}

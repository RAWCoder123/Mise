export type TeamHubLoadState = "loading" | "ready" | "error";

export function resolveTeamHubLoadState(input: {
  restaurantId: string | null | undefined;
  loadedRestaurantId: string | null;
  loadError: boolean;
}): TeamHubLoadState {
  if (!input.restaurantId) return "ready";
  if (input.loadedRestaurantId === input.restaurantId) return "ready";
  if (input.loadError) return "error";
  return "loading";
}

export function presentTeamHubRosterCopy(
  state: TeamHubLoadState,
  memberCount: number,
  copy: {
    loading: string;
    unavailable: string;
    rosterBody: (count: string) => string;
  },
  formatNumber: (value: number) => string
): string {
  if (state === "loading") return copy.loading;
  if (state === "error") return copy.unavailable;
  return copy.rosterBody(formatNumber(memberCount));
}

export function presentTeamHubEmptyCopy(
  state: TeamHubLoadState,
  copy: {
    loadingTitle: string;
    loadingBody: string;
    unavailableTitle: string;
    unavailableBody: string;
    emptyTitle: string;
    emptyBody: string;
  }
): { title: string; body: string } {
  if (state === "loading") {
    return { title: copy.loadingTitle, body: copy.loadingBody };
  }
  if (state === "error") {
    return { title: copy.unavailableTitle, body: copy.unavailableBody };
  }
  return { title: copy.emptyTitle, body: copy.emptyBody };
}

export function presentTeamHubPendingInvitesCopy(
  state: TeamHubLoadState,
  input: {
    pendingCount: number;
    canManage: boolean;
  },
  copy: {
    loading: string;
    unavailable: string;
    empty: string;
    body: (count: string) => string;
    readOnlyBody: (count: string) => string;
  },
  formatNumber: (value: number) => string
): { sectionBody: string; emptyHelper: string | null } {
  if (state === "loading") {
    return { sectionBody: copy.loading, emptyHelper: null };
  }
  if (state === "error") {
    return { sectionBody: copy.unavailable, emptyHelper: null };
  }
  const count = formatNumber(input.pendingCount);
  return {
    sectionBody: input.canManage ? copy.body(count) : copy.readOnlyBody(count),
    emptyHelper: input.pendingCount === 0 ? copy.empty : null
  };
}

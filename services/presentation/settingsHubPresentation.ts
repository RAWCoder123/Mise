import type { RestaurantEmailConnection } from "../../types/mise";

export type SettingsHubLoadState = "loading" | "ready" | "error";

export function resolveSettingsHubLoadState(input: {
  restaurantId: string | null | undefined;
  loadedRestaurantId: string | null;
  loadError: boolean;
}): SettingsHubLoadState {
  if (!input.restaurantId) return "ready";
  if (input.loadedRestaurantId === input.restaurantId) return "ready";
  if (input.loadError) return "error";
  return "loading";
}

export function presentSettingsHubGmailCopy(
  state: SettingsHubLoadState,
  connection: RestaurantEmailConnection | null,
  copy: {
    loading: string;
    unavailable: string;
    connectedWithSender: (sender: string) => string;
    connected: string;
    reconnect: string;
    restricted: string;
    notConnected: string;
    statusLoading: string;
    statusUnavailable: string;
    statusConnected: string;
    statusNeedsReauth: string;
    statusRestricted: string;
    statusNotConnected: string;
  }
): { subtitle: string; badgeLabel: string; tone: "leaf" | "caution" | "neutral" } {
  if (state === "loading") {
    return { subtitle: copy.loading, badgeLabel: copy.statusLoading, tone: "neutral" };
  }
  if (state === "error") {
    return { subtitle: copy.unavailable, badgeLabel: copy.statusUnavailable, tone: "neutral" };
  }
  if (connection?.status === "connected") {
    return {
      subtitle: connection.sender_email
        ? copy.connectedWithSender(connection.sender_email)
        : copy.connected,
      badgeLabel: copy.statusConnected,
      tone: "leaf"
    };
  }
  if (connection?.status === "needs_reauth") {
    return { subtitle: copy.reconnect, badgeLabel: copy.statusNeedsReauth, tone: "caution" };
  }
  if (connection?.status === "restricted") {
    return { subtitle: copy.restricted, badgeLabel: copy.statusRestricted, tone: "caution" };
  }
  return { subtitle: copy.notConnected, badgeLabel: copy.statusNotConnected, tone: "neutral" };
}

export function presentSettingsHubSupplierCopy(
  state: SettingsHubLoadState,
  suppliers: readonly string[],
  copy: {
    loading: string;
    unavailable: string;
    empty: string;
    list: (values: readonly string[]) => string;
    more: (listed: string, remainingCount: string) => string;
  },
  formatNumber: (value: number) => string
): { subtitle: string; value: string | undefined } {
  if (state === "loading") {
    return { subtitle: copy.loading, value: undefined };
  }
  if (state === "error") {
    return { subtitle: copy.unavailable, value: undefined };
  }
  if (suppliers.length === 0) {
    return { subtitle: copy.empty, value: formatNumber(0) };
  }
  if (suppliers.length <= 2) {
    return { subtitle: copy.list(suppliers), value: formatNumber(suppliers.length) };
  }
  return {
    subtitle: copy.more(copy.list(suppliers.slice(0, 2)), formatNumber(suppliers.length - 2)),
    value: formatNumber(suppliers.length)
  };
}

export function presentSettingsHubRecipesCopy(
  state: SettingsHubLoadState,
  counts: { unmapped: number; incompatible: number },
  copy: {
    loading: string;
    unavailable: string;
    body: string;
    unmappedOne: string;
    unmapped: (count: string) => string;
    incompatibleOne: string;
    incompatible: (count: string) => string;
  },
  formatNumber: (value: number) => string
): { subtitle: string; badgeLabel: string | undefined; caution: boolean } {
  if (state === "loading") {
    return { subtitle: copy.loading, badgeLabel: undefined, caution: false };
  }
  if (state === "error") {
    return { subtitle: copy.unavailable, badgeLabel: undefined, caution: false };
  }
  if (counts.incompatible === 1) {
    return { subtitle: copy.incompatibleOne, badgeLabel: formatNumber(1), caution: true };
  }
  if (counts.incompatible > 1) {
    return {
      subtitle: copy.incompatible(formatNumber(counts.incompatible)),
      badgeLabel: formatNumber(counts.incompatible),
      caution: true
    };
  }
  if (counts.unmapped === 1) {
    return { subtitle: copy.unmappedOne, badgeLabel: formatNumber(1), caution: true };
  }
  if (counts.unmapped > 1) {
    return {
      subtitle: copy.unmapped(formatNumber(counts.unmapped)),
      badgeLabel: formatNumber(counts.unmapped),
      caution: true
    };
  }
  return { subtitle: copy.body, badgeLabel: undefined, caution: false };
}

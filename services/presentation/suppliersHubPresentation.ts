export type SuppliersHubLoadState = "loading" | "ready" | "error";

export type SuppliersMutationNoticeReason = "invalidEmail" | "saved" | "saveError";

export function resolveSuppliersHubLoadState(input: {
  restaurantId: string | null | undefined;
  loadedRestaurantId: string | null;
  loadError: boolean;
}): SuppliersHubLoadState {
  if (!input.restaurantId) return "ready";
  if (input.loadedRestaurantId === input.restaurantId) return "ready";
  if (input.loadError) return "error";
  return "loading";
}

export function presentSuppliersHubConfiguredCount(
  state: SuppliersHubLoadState,
  configuredCount: number,
  totalCount: number,
  copy: {
    loading: string;
    unavailable: string;
    configuredCount: (configured: string, total: string) => string;
  },
  formatNumber: (value: number) => string
): string {
  if (state === "loading") return copy.loading;
  if (state === "error") return copy.unavailable;
  return copy.configuredCount(formatNumber(configuredCount), formatNumber(totalCount));
}

export function presentSuppliersHubEmptyCopy(
  state: SuppliersHubLoadState,
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

export function presentSuppliersMutationBusy(savingCount: number): boolean {
  return savingCount > 0;
}

export function presentSuppliersMutationActionsEditable(
  canManage: boolean,
  busy: boolean,
  hubReady: boolean
): boolean {
  return canManage && !busy && hubReady;
}

export function presentSuppliersMutationNoticeCopy(
  reason: SuppliersMutationNoticeReason,
  copy: Record<SuppliersMutationNoticeReason, { title: string; message: string }>
): { tone: "danger" | "success" | "caution"; title: string; message: string } {
  const selected = copy[reason] ?? copy.saveError;
  if (reason === "invalidEmail") {
    return { tone: "caution", title: selected.title, message: selected.message };
  }
  if (reason === "saveError") {
    return { tone: "danger", title: selected.title, message: selected.message };
  }
  return { tone: "success", title: selected.title, message: selected.message };
}

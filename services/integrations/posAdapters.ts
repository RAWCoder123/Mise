import type { PosIntegrationProvider, PosSale, Restaurant } from "../../types/mise";

export interface PosSyncWindow {
  from: string;
  to: string;
}

export interface PosCatalogItem {
  externalId: string;
  name: string;
  category: string;
}

export interface PosAdapterSyncResult {
  provider: PosIntegrationProvider;
  sales: Omit<PosSale, "id" | "restaurant_id" | "created_at">[];
  catalogItems: PosCatalogItem[];
  cursor: string | null;
}

export interface PosAdapter {
  provider: PosIntegrationProvider;
  displayName: string;
  supportsCatalog: boolean;
  supportsInventory: boolean;
  syncSales(restaurant: Restaurant, window: PosSyncWindow, cursor?: string | null): Promise<PosAdapterSyncResult>;
}

function createUnavailableAdapter(
  provider: PosIntegrationProvider,
  displayName: string,
  supportsCatalog: boolean
): PosAdapter {
  return {
    provider,
    displayName,
    supportsCatalog,
    supportsInventory: false,
    async syncSales() {
      throw new Error(`${displayName} sync requires a server-side Edge Function with provider secrets.`);
    }
  };
}

export const posAdapters: Record<PosIntegrationProvider, PosAdapter> = {
  square: createUnavailableAdapter("square", "Square", true),
  toast: createUnavailableAdapter("toast", "Toast", true),
  clover: createUnavailableAdapter("clover", "Clover", true),
  lightspeed: createUnavailableAdapter("lightspeed", "Lightspeed", true),
  manual_csv: createUnavailableAdapter("manual_csv", "Manual CSV", false),
  demo: {
    provider: "demo",
    displayName: "Demo POS",
    supportsCatalog: true,
    supportsInventory: false,
    async syncSales(_restaurant, _window, cursor = null) {
      return {
        provider: "demo",
        sales: [],
        catalogItems: [],
        cursor
      };
    }
  }
};

export function getPosAdapter(provider: PosIntegrationProvider) {
  return posAdapters[provider];
}

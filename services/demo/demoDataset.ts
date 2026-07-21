import type { PosProvider } from "../../types/mise";

/**
 * The single identity/configuration record for local demo data.
 *
 * Replace this object together with `replaceableDemoData.ts` to swap the
 * sample restaurant without changing screens, session logic, repositories,
 * or domain services.
 */
export const DEMO_DATASET = {
  id: "default",
  label: "Demo data",
  restaurant: {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Demo Restaurant",
    cuisineType: "Sample full-service restaurant",
    timezone: "America/New_York"
  },
  user: {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Demo Operator",
    email: "demo@mise.test"
  },
  defaultPosProvider: "Toast" as PosProvider
} as const;

export type DemoDatasetId = typeof DEMO_DATASET.id;

export function isDemoDatasetRestaurantName(value: string | null | undefined) {
  return value?.trim().toLowerCase() === DEMO_DATASET.restaurant.name.toLowerCase();
}

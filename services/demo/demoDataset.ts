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

/**
 * ASCII C-locale case fold — mirrors SQL `lower(... collate "C")`
 * (MISE-005JP). Only ASCII A-Z is folded; Unicode-aware `toLowerCase` /
 * `toLocaleLowerCase` would map Kelvin sign `K` → `k` and invent a demo
 * restaurant-name match the hosted COLLATE C path would not.
 */
function asciiCLower(value: string) {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

/**
 * Trim only ASCII whitespace so demo restaurant-name identity stays aligned
 * with server helpers that btrim under COLLATE "C".
 */
function asciiCTrim(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

/**
 * Demo restaurant-name identity used to label demo mode, seed the default
 * dataset, and repair reference demo state. Pinned to ASCII C so Kelvin /
 * NBSP cannot invent or suppress the demo restaurant match.
 */
export function normalizeDemoDatasetRestaurantName(value: string) {
  return asciiCLower(asciiCTrim(value));
}

export function isDemoDatasetRestaurantName(value: string | null | undefined) {
  if (value == null) {
    return false;
  }
  return (
    normalizeDemoDatasetRestaurantName(value) ===
    normalizeDemoDatasetRestaurantName(DEMO_DATASET.restaurant.name)
  );
}

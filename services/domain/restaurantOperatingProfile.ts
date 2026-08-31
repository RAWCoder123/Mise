import type { Restaurant, RestaurantOperationalProfile } from "../../types/mise";
import {
  RESTAURANT_PROFILE_ARRAY_ITEM_MAX_CHARACTERS,
  RESTAURANT_PROFILE_ARRAY_MAX_ITEMS,
  RESTAURANT_PROFILE_NOTES_MAX_CHARACTERS
} from "./securityLimits";

/** Short weekday tokens used by setup and the operating-profile editor. */
export const OPERATING_PROFILE_WEEKDAYS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun"
] as const;

export type OperatingProfileWeekday = (typeof OPERATING_PROFILE_WEEKDAYS)[number];

/** Common prep-window presets; free-text custom values remain allowed. */
export const OPERATING_PROFILE_PREP_PRESETS = [
  "Pre-service count",
  "Post-service review",
  "AM prep",
  "Dinner reset",
  "Close count"
] as const;

export type RestaurantOperatingProfileDraft = {
  orderCadence: string[];
  prepWindows: string[];
  inventoryReviewDays: string[];
  notes: string;
};

export type RestaurantOperatingProfilePatch = {
  operational_profile: RestaurantOperationalProfile;
};

export {
  RESTAURANT_PROFILE_ARRAY_ITEM_MAX_CHARACTERS,
  RESTAURANT_PROFILE_ARRAY_MAX_ITEMS,
  RESTAURANT_PROFILE_NOTES_MAX_CHARACTERS
};

const WEEKDAY_ALIASES: Record<string, OperatingProfileWeekday> = {
  mon: "Mon",
  monday: "Mon",
  tue: "Tue",
  tues: "Tue",
  tuesday: "Tue",
  wed: "Wed",
  wednesday: "Wed",
  thu: "Thu",
  thur: "Thu",
  thurs: "Thu",
  thursday: "Thu",
  fri: "Fri",
  friday: "Fri",
  sat: "Sat",
  saturday: "Sat",
  sun: "Sun",
  sunday: "Sun"
};

/**
 * Normalize a free-form cadence/review day to the short weekday token when
 * recognizable; otherwise keep the trimmed original string.
 */
export function normalizeOperatingProfileDay(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const alias = WEEKDAY_ALIASES[trimmed.toLowerCase()];
  return alias ?? trimmed;
}

export function draftFromOperatingProfile(
  restaurant: Restaurant
): RestaurantOperatingProfileDraft {
  const profile = restaurant.operational_profile;
  return {
    orderCadence: uniquePreserveOrder(
      profile.orderCadence.map(normalizeOperatingProfileDay).filter(Boolean)
    ),
    prepWindows: uniquePreserveOrder(
      profile.prepWindows.map((value) => value.trim()).filter(Boolean)
    ),
    inventoryReviewDays: uniquePreserveOrder(
      profile.inventoryReviewDays.map(normalizeOperatingProfileDay).filter(Boolean)
    ),
    notes: profile.notes ?? ""
  };
}

export function toggleOrderedString(list: readonly string[], value: string): string[] {
  const normalized = value.trim();
  if (!normalized) return [...list];
  if (list.includes(normalized)) {
    return list.filter((entry) => entry !== normalized);
  }
  if (list.length >= RESTAURANT_PROFILE_ARRAY_MAX_ITEMS) {
    return [...list];
  }
  return [...list, normalized];
}

export function addCustomProfileString(list: readonly string[], raw: string): string[] {
  const normalized = raw.trim();
  if (!normalized) return [...list];
  if (normalized.length > RESTAURANT_PROFILE_ARRAY_ITEM_MAX_CHARACTERS) {
    throw new Error(
      `Profile entry is limited to ${RESTAURANT_PROFILE_ARRAY_ITEM_MAX_CHARACTERS} characters.`
    );
  }
  if (list.includes(normalized)) return [...list];
  if (list.length >= RESTAURANT_PROFILE_ARRAY_MAX_ITEMS) {
    throw new Error(`Profile list is limited to ${RESTAURANT_PROFILE_ARRAY_MAX_ITEMS} entries.`);
  }
  return [...list, normalized];
}

export function removeProfileString(list: readonly string[], value: string): string[] {
  return list.filter((entry) => entry !== value);
}

/**
 * Build an operational_profile patch. Preserves durable primarySuppliers text
 * (supplier authority lives on suppliers.*) and mirrors restaurant.service_style.
 */
export function buildRestaurantOperatingProfilePatch(
  restaurant: Restaurant,
  draft: RestaurantOperatingProfileDraft
): RestaurantOperatingProfilePatch | null {
  const nextProfile: RestaurantOperationalProfile = {
    serviceStyle: restaurant.service_style,
    orderCadence: uniquePreserveOrder(
      draft.orderCadence.map(normalizeOperatingProfileDay).filter(Boolean)
    ),
    prepWindows: uniquePreserveOrder(
      draft.prepWindows.map((value) => value.trim()).filter(Boolean)
    ),
    primarySuppliers: [...restaurant.operational_profile.primarySuppliers],
    inventoryReviewDays: uniquePreserveOrder(
      draft.inventoryReviewDays.map(normalizeOperatingProfileDay).filter(Boolean)
    ),
    notes: (() => {
      const trimmed = draft.notes.trim();
      return trimmed.length === 0 ? null : trimmed;
    })()
  };

  if (!operatingProfileChanged(restaurant.operational_profile, nextProfile)) {
    return null;
  }

  return { operational_profile: nextProfile };
}

export function operatingProfileChanged(
  current: RestaurantOperationalProfile,
  next: RestaurantOperationalProfile
): boolean {
  return (
    current.serviceStyle !== next.serviceStyle ||
    !sameStringList(current.orderCadence, next.orderCadence) ||
    !sameStringList(current.prepWindows, next.prepWindows) ||
    !sameStringList(current.primarySuppliers, next.primarySuppliers) ||
    !sameStringList(current.inventoryReviewDays, next.inventoryReviewDays) ||
    (current.notes ?? null) !== (next.notes ?? null)
  );
}

function sameStringList(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function uniquePreserveOrder(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

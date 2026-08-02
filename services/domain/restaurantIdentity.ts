import type { Restaurant, RestaurantServiceStyle } from "../../types/mise";
import {
  RESTAURANT_ADDRESS_MAX_CHARACTERS,
  RESTAURANT_CUISINE_MAX_CHARACTERS,
  RESTAURANT_NAME_MAX_CHARACTERS
} from "./securityLimits";

export const RESTAURANT_SERVICE_STYLES: readonly RestaurantServiceStyle[] = [
  "quick_service",
  "fast_casual",
  "full_service",
  "bar",
  "cafe",
  "ghost_kitchen"
] as const;

/** Common operator timezones; current restaurant values outside this list remain selectable. */
export const COMMON_RESTAURANT_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Mexico_City",
  "Europe/London",
  "Europe/Paris",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC"
] as const;

/** Common settlement currencies; current restaurant values outside this list remain selectable. */
export const COMMON_RESTAURANT_CURRENCIES = [
  "USD",
  "CAD",
  "MXN",
  "EUR",
  "GBP",
  "AUD",
  "JPY",
  "CNY"
] as const;

export type RestaurantIdentityDraft = {
  name: string;
  address: string;
  cuisine_type: string;
  service_style: RestaurantServiceStyle;
  timezone: string;
  currency: string;
};

export type RestaurantIdentityPatch = Partial<
  Pick<Restaurant, "name" | "address" | "cuisine_type" | "service_style" | "timezone" | "currency">
>;

export {
  RESTAURANT_ADDRESS_MAX_CHARACTERS,
  RESTAURANT_CUISINE_MAX_CHARACTERS,
  RESTAURANT_NAME_MAX_CHARACTERS
};

export function draftFromRestaurant(restaurant: Restaurant): RestaurantIdentityDraft {
  return {
    name: restaurant.name,
    address: restaurant.address ?? "",
    cuisine_type: restaurant.cuisine_type ?? "",
    service_style: restaurant.service_style,
    timezone: restaurant.timezone,
    currency: restaurant.currency
  };
}

export function restaurantIdentityOptions(restaurant: Restaurant | null | undefined) {
  const timezones = uniquePreserveOrder([
    ...(restaurant?.timezone ? [restaurant.timezone] : []),
    ...COMMON_RESTAURANT_TIMEZONES
  ]);
  const currencies = uniquePreserveOrder([
    ...(restaurant?.currency ? [restaurant.currency] : []),
    ...COMMON_RESTAURANT_CURRENCIES
  ]);
  return {
    serviceStyles: [...RESTAURANT_SERVICE_STYLES],
    timezones,
    currencies
  };
}

/**
 * Build a sparse profile patch from an identity draft.
 * Empty address/cuisine become null so operators can clear optional fields.
 */
export function buildRestaurantIdentityPatch(
  restaurant: Restaurant,
  draft: RestaurantIdentityDraft
): RestaurantIdentityPatch {
  const nextName = draft.name.trim();
  const nextAddress = draft.address.trim();
  const nextCuisine = draft.cuisine_type.trim();
  const patch: RestaurantIdentityPatch = {};

  if (nextName !== restaurant.name) {
    patch.name = nextName;
  }

  const currentAddress = restaurant.address ?? "";
  if (nextAddress !== currentAddress) {
    patch.address = nextAddress.length === 0 ? null : nextAddress;
  }

  const currentCuisine = restaurant.cuisine_type ?? "";
  if (nextCuisine !== currentCuisine) {
    patch.cuisine_type = nextCuisine.length === 0 ? null : nextCuisine;
  }

  if (draft.service_style !== restaurant.service_style) {
    patch.service_style = draft.service_style;
  }

  if (draft.timezone !== restaurant.timezone) {
    patch.timezone = draft.timezone;
  }

  if (draft.currency !== restaurant.currency) {
    patch.currency = draft.currency;
  }

  return patch;
}

export function restaurantIdentityChanged(patch: RestaurantIdentityPatch) {
  return Object.keys(patch).length > 0;
}

function uniquePreserveOrder(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

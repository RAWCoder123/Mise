import type { Restaurant, RestaurantServiceStyle } from "../../types/mise";
import {
  RESTAURANT_ADDRESS_MAX_CHARACTERS,
  RESTAURANT_CUISINE_MAX_CHARACTERS,
  RESTAURANT_LOGO_URL_MAX_CHARACTERS,
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

/**
 * Curated brand/accent presets for restaurant identity.
 * Keep the palette small and operationally calm — not decorative rainbow chips.
 */
export const RESTAURANT_BRAND_COLOR_PRESETS = [
  "#EF3F27",
  "#F5222D",
  "#171715",
  "#2A2A27",
  "#B35600",
  "#1F7A4D",
  "#357B45",
  "#1F4B7A"
] as const;

export type RestaurantIdentityDraft = {
  name: string;
  address: string;
  cuisine_type: string;
  service_style: RestaurantServiceStyle;
  timezone: string;
  currency: string;
  brand_color: string;
  accent_color: string;
  logo_url: string;
};

export type RestaurantIdentityPatch = Partial<
  Pick<
    Restaurant,
    | "name"
    | "address"
    | "cuisine_type"
    | "service_style"
    | "timezone"
    | "currency"
    | "brand_color"
    | "accent_color"
    | "logo_url"
  >
>;

export {
  RESTAURANT_ADDRESS_MAX_CHARACTERS,
  RESTAURANT_CUISINE_MAX_CHARACTERS,
  RESTAURANT_LOGO_URL_MAX_CHARACTERS,
  RESTAURANT_NAME_MAX_CHARACTERS
};

export function draftFromRestaurant(restaurant: Restaurant): RestaurantIdentityDraft {
  return {
    name: restaurant.name,
    address: restaurant.address ?? "",
    cuisine_type: restaurant.cuisine_type ?? "",
    service_style: restaurant.service_style,
    timezone: restaurant.timezone,
    currency: restaurant.currency,
    brand_color: normalizeHexColorDraft(restaurant.brand_color, "#EF3F27"),
    accent_color: normalizeHexColorDraft(restaurant.accent_color, "#EF3F27"),
    logo_url: restaurant.logo_url ?? ""
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
  const brandColors = uniquePreserveOrder([
    ...(restaurant?.brand_color
      ? [normalizeHexColorDraft(restaurant.brand_color, restaurant.brand_color)]
      : []),
    ...(restaurant?.accent_color
      ? [normalizeHexColorDraft(restaurant.accent_color, restaurant.accent_color)]
      : []),
    ...RESTAURANT_BRAND_COLOR_PRESETS
  ]);
  return {
    serviceStyles: [...RESTAURANT_SERVICE_STYLES],
    timezones,
    currencies,
    brandColors
  };
}

/**
 * Build a sparse profile patch from an identity draft.
 * Empty address/cuisine/logo become null so operators can clear optional fields.
 */
export function buildRestaurantIdentityPatch(
  restaurant: Restaurant,
  draft: RestaurantIdentityDraft
): RestaurantIdentityPatch {
  const nextName = draft.name.trim();
  const nextAddress = draft.address.trim();
  const nextCuisine = draft.cuisine_type.trim();
  const nextLogo = draft.logo_url.trim();
  const nextBrand = normalizeHexColorDraft(draft.brand_color, draft.brand_color.trim());
  const nextAccent = normalizeHexColorDraft(draft.accent_color, draft.accent_color.trim());
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

  const currentBrand = normalizeHexColorDraft(restaurant.brand_color, restaurant.brand_color);
  if (nextBrand.toUpperCase() !== currentBrand.toUpperCase()) {
    patch.brand_color = nextBrand;
  }

  const currentAccent = normalizeHexColorDraft(restaurant.accent_color, restaurant.accent_color);
  if (nextAccent.toUpperCase() !== currentAccent.toUpperCase()) {
    patch.accent_color = nextAccent;
  }

  const currentLogo = restaurant.logo_url ?? "";
  if (nextLogo !== currentLogo) {
    patch.logo_url = nextLogo.length === 0 ? null : nextLogo;
  }

  return patch;
}

export function restaurantIdentityChanged(patch: RestaurantIdentityPatch) {
  return Object.keys(patch).length > 0;
}

/** True when the draft hex looks like a valid #RRGGBB value operators can save. */
export function isValidRestaurantHexColor(value: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value.trim());
}

function normalizeHexColorDraft(value: string | null | undefined, fallback: string) {
  if (typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value.trim())) {
    return `#${value.trim().slice(1).toUpperCase()}`;
  }
  if (typeof fallback === "string" && /^#[0-9A-Fa-f]{6}$/.test(fallback.trim())) {
    return `#${fallback.trim().slice(1).toUpperCase()}`;
  }
  return fallback;
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

import { colors } from "../constants/theme";
import { presentationRestaurantInitialsFromSeed } from "../services/domain/presentationRestaurantInitialsIdentity";
import type { Restaurant, RestaurantServiceStyle } from "../types/mise";

export function restaurantBrandColor(restaurant?: Restaurant | null) {
  return restaurant?.brand_color ?? colors.accent;
}

export function restaurantAccentColor(restaurant?: Restaurant | null) {
  return restaurant?.accent_color ?? colors.accent;
}

export function restaurantInitials(restaurant?: Restaurant | null) {
  return presentationRestaurantInitialsFromSeed(restaurant?.name);
}

export function serviceStyleLabel(value?: RestaurantServiceStyle | null) {
  switch (value) {
    case "quick_service":
      return "Quick service";
    case "full_service":
      return "Full service";
    case "bar":
      return "Bar";
    case "cafe":
      return "Cafe";
    case "ghost_kitchen":
      return "Ghost kitchen";
    case "fast_casual":
    default:
      return "Fast casual";
  }
}

export function restaurantProfileLine(restaurant?: Restaurant | null) {
  if (!restaurant) return "No restaurant selected";
  const cuisine = restaurant.cuisine_type ?? "Restaurant";
  return `${cuisine} · ${serviceStyleLabel(restaurant.service_style)}`;
}

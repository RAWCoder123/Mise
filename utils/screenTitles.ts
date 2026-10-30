import { normalizePresentationTodayScreenTitleRestaurantName } from "../services/domain/presentationTodayScreenTitleIdentity";

export function todayScreenTitle(restaurantName?: string | null) {
  // MISE-005UD: pin Today screen title restaurant-name prep to ASCII C.
  // Soft-null / Unicode-padded names fall through to "Today at Mise"
  // without inventing a clean restaurant identity via Unicode `.trim()`.
  const trimmedName =
    normalizePresentationTodayScreenTitleRestaurantName(restaurantName);
  return trimmedName ? `Today at ${trimmedName}` : "Today at Mise";
}

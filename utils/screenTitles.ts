export function todayScreenTitle(restaurantName?: string | null) {
  const trimmedName = restaurantName?.trim();
  return trimmedName ? `Today at ${trimmedName}` : "Today at Mise";
}

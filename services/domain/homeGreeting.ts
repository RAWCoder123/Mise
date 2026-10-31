import { hourInTimeZone } from "./operatingPlan";

export type HomeGreetingPeriod = "morning" | "afternoon" | "evening";

/**
 * Restaurant-local time-of-day greeting period. Fails closed before
 * `hourInTimeZone` can silently fall back to UTC and invent the wrong
 * morning / afternoon / evening claim from a Unicode-padded or invalid IANA
 * timezone.
 */
export function greetingPeriodForNow(
  timeZone: string,
  now: Date = new Date()
): HomeGreetingPeriod {
  requireRestaurantTimeZone(timeZone);
  const hour = hourInTimeZone(
    now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date(),
    timeZone
  );
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

/**
 * Fail closed before `hourInTimeZone` can silently fall back to UTC.
 * Emptiness uses `.trim()` only as a Boolean gate; the raw timezone is what
 * Intl validates. Unicode-padded or otherwise invalid IANA names reject here
 * instead of inventing a wrong restaurant-local greeting period via UTC.
 */
function requireRestaurantTimeZone(timeZone: string) {
  if (!timeZone.trim()) {
    throw new Error("Home greeting requires a restaurant timezone.");
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
  } catch {
    throw new Error("Home greeting requires a valid restaurant timezone.");
  }
}

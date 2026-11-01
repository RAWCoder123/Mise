/**
 * Restaurant-local calendar day for Orders delivery-evidence timestamps.
 *
 * Fail closed before `restaurant?.timezone ?? "UTC"` can invent a UTC calendar
 * day near timezone boundaries, and before Unicode-padded or otherwise invalid
 * IANA names can reach formatters that strip the rejected zone and invent a
 * host-local day. Emptiness uses `.trim()` only as a Boolean gate; Intl
 * validates the raw value. Do not Unicode-trim into a clean IANA identity.
 */
export function restaurantTimeZoneForDeliveryEvidence(
  timeZone: string | null | undefined
): string {
  if (typeof timeZone !== "string" || !timeZone.trim()) {
    throw new Error("Delivery evidence date requires a restaurant timezone.");
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
  } catch {
    throw new Error("Delivery evidence date requires a valid restaurant timezone.");
  }
  return timeZone;
}

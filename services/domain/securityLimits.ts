export const SUPPLIER_NOTE_MAX_CHARACTERS = 2_000;
export const ORDER_MESSAGE_MAX_BYTES = 64 * 1024;
export const RESTAURANT_NAME_MAX_CHARACTERS = 120;
export const RESTAURANT_ADDRESS_MAX_CHARACTERS = 500;
export const RESTAURANT_CUISINE_MAX_CHARACTERS = 120;
export const RESTAURANT_LOGO_URL_MAX_CHARACTERS = 2_048;
export const RESTAURANT_OPERATIONAL_PROFILE_MAX_BYTES = 16 * 1024;
export const RESTAURANT_PROFILE_ARRAY_MAX_ITEMS = 20;
export const RESTAURANT_PROFILE_ARRAY_ITEM_MAX_CHARACTERS = 160;
export const RESTAURANT_PROFILE_NOTES_MAX_CHARACTERS = 2_000;
export const STRUCTURED_AI_INSIGHT_MAX_BYTES = 16 * 1024;
/**
 * Maximum age of inventory_events.effective_at relative to the accept clock.
 * Blocks epoch/year-bug timestamps and absurdly delayed backdating while still
 * allowing multi-week offline outbox sync and late delivery/waste logging.
 * Mirrors the reject_far_past_inventory_event database trigger (90 days).
 * Distinct from purchase-authority count freshness (36 hours) and from the
 * future-dated skew guard (2 minutes).
 */
export const INVENTORY_EVENT_EFFECTIVE_AT_MAX_LOOKBACK_DAYS = 90;
export const INVENTORY_EVENT_EFFECTIVE_AT_MAX_LOOKBACK_MS =
  INVENTORY_EVENT_EFFECTIVE_AT_MAX_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

export function utf8ByteLength(value: string) {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
}

export function truncateUtf8(value: string, maximumBytes: number) {
  if (maximumBytes <= 0) return "";
  let bytes = 0;
  let result = "";
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    const characterBytes = codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
    if (bytes + characterBytes > maximumBytes) break;
    result += character;
    bytes += characterBytes;
  }
  return result;
}

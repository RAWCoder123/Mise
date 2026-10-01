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
 * Maximum fractional decimal places allowed on inventory_events.quantity.
 * Six places matches established canonical conversion rounding (round(..., 6))
 * while rejecting floating-point dust that pollutes append-only ledger history.
 */
export const LEDGER_QUANTITY_MAX_SCALE = 6;

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

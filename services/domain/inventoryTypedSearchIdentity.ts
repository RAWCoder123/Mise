import type { InventoryItem } from "../../types/mise";

/**
 * ASCII C-locale case fold — mirrors SQL `lower(... collate "C")`
 * (MISE-005KC). Only ASCII A-Z is folded; Unicode-aware `toLowerCase`
 * would map Kelvin sign `K` → `k` and invent an Inventory / Log Delivery
 * typed-search match the ASCII C path would refuse.
 */
function asciiCLower(value: string) {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

/**
 * Trim only ASCII whitespace so Inventory and Log Delivery search needles
 * stay aligned with server helpers that btrim under COLLATE "C".
 */
function asciiCTrim(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

/**
 * Normalize one typed-search token (query needle or inventory field) to
 * ASCII C case fold + ASCII-only end trim. Mid-string non-C whitespace is
 * preserved so em-space / NBSP cannot invent substring identity.
 */
export function normalizeInventoryTypedSearchToken(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  return asciiCLower(asciiCTrim(value));
}

function haystackIncludesNeedle(parts: Array<string | null | undefined>, query: string): boolean {
  const needle = normalizeInventoryTypedSearchToken(query);
  if (!needle) return true;
  const haystack = normalizeInventoryTypedSearchToken(parts.filter(Boolean).join(" "));
  return haystack.includes(needle);
}

/**
 * Inventory tab typed-search: item name, supplier, category, and the
 * localized coverage label. Fields are matched independently (OR) so a
 * needle cannot invent identity across field boundaries. Empty /
 * whitespace-only queries match every row.
 */
export function inventoryOutlookMatchesTypedSearchQuery(
  item: InventoryItem,
  coverageLabel: string,
  query: string
): boolean {
  const needle = normalizeInventoryTypedSearchToken(query);
  if (!needle) return true;
  return [item.item_name, item.supplier_name, item.category, coverageLabel].some((field) =>
    normalizeInventoryTypedSearchToken(field).includes(needle)
  );
}

/**
 * Log Delivery typed-search: item name, id, category, and supplier.
 * Empty / whitespace-only queries match every item (browse-all).
 */
export function logDeliveryItemMatchesTypedSearchQuery(item: InventoryItem, query: string): boolean {
  return haystackIncludesNeedle(
    [item.item_name, item.id, item.category, item.supplier_name],
    query
  );
}

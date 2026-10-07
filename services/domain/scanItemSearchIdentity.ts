import type { InventoryItem } from "../../types/mise";

/**
 * ASCII C-locale case fold — mirrors SQL `lower(... collate "C")`
 * (MISE-005KB). Only ASCII A-Z is folded; Unicode-aware `toLowerCase`
 * would map Kelvin sign `K` → `k` and invent a Scan Item text-search
 * match the ASCII C path would refuse.
 */
function asciiCLower(value: string) {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

/**
 * Trim only ASCII whitespace so Scan Item search needles stay aligned
 * with server helpers that btrim under COLLATE "C".
 */
function asciiCTrim(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

/**
 * Normalize one Scan Item search token (query needle or inventory field)
 * to ASCII C case fold + ASCII-only end trim. Mid-string non-C whitespace
 * is preserved so em-space / NBSP cannot invent substring identity.
 */
export function normalizeScanItemSearchToken(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  return asciiCLower(asciiCTrim(value));
}

/**
 * Whether an inventory row matches the Scan Item typed-search query.
 * Empty / whitespace-only queries match every item (browse-all).
 */
export function scanItemMatchesQuery(item: InventoryItem, query: string): boolean {
  const needle = normalizeScanItemSearchToken(query);
  if (!needle) return true;
  const haystack = normalizeScanItemSearchToken(
    [item.item_name, item.id, item.category, item.supplier_name, item.unit]
      .filter(Boolean)
      .join(" ")
  );
  return haystack.includes(needle);
}

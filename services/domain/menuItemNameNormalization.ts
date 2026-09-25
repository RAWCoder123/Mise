import { foldPurchaseLineAccents } from "./purchaseLines";

/**
 * MISE-005C. Matches `private.normalize_menu_item_name`: btrim default spaces,
 * accent-fold (MISE-005A map), then lowercase A-Z only (same as
 * `lower(... COLLATE "C")`).
 *
 * Discovery key only — never recipe/POS mapping authority. Stored menu names
 * keep operator-facing accents; the key folds them so JALAPEÑO and Jalapeño
 * share one ctype-stable identity. `toLowerCase` / `\s` are Unicode-aware and
 * would not match the server.
 */
export function normalizeMenuItemName(raw: string): string | null {
  const trimmed = raw.replace(/^ +/, "").replace(/ +$/, "");
  if (trimmed.length === 0) return null;
  return foldPurchaseLineAccents(trimmed).replace(/[A-Z]/g, (character) =>
    character.toLowerCase()
  );
}

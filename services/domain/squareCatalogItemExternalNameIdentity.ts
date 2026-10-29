/**
 * Square catalog item external-name identity helpers (MISE-005TI).
 *
 * Pins Edge `normalizeCatalogItem` catalog item `item_data.name` → durable
 * `SquareCatalogRow.external_name` outside the Expo UI graph so Node tests can
 * exercise inventing proofs without loading React Native. The prior path
 * Unicode-trimmed item `name` through shared `stringField` before storing it
 * on normalized catalog rows (and falling back to `"Untitled item"` on soft
 * empty) (`'\u2003Burger\u2003'.trim() === 'Burger'`), so NBSP/em-space
 * padding invented a clean catalog item external name used for POS catalog
 * presentation, recipe mapping lookup surfaces, and inventory planning.
 * Soft-empty Unicode-only padding also collapsed through `.trim()` into the
 * intentional `"Untitled item"` fallback.
 *
 * These are Square **catalog item name / external_name** tokens only — not
 * Square catalog item `id` → `external_catalog_item_id` (#946 / MISE-005TH),
 * not Square catalog variation list `id` → `external_variation_id` (#945 /
 * MISE-005TG), not Square catalog variation `name` / `variation_name`
 * composition, not Square order-sale line-item `name` → `item_name` (#941 /
 * MISE-005TC), not Square location-list display `name`, not Square OAuth
 * `merchant_id` (#944 / MISE-005TF), and not repository Square integration
 * error haystacks (#929 / MISE-005SQ). Soft empty / Unicode-padded / overlong
 * / control-bearing tokens soft-null so padded catalog item names cannot
 * invent durable `external_name` identity. Ordinary ASCII whitespace still
 * trims clean. Case and accents are left unchanged. The live
 * `?? "Untitled item"` fallback owns soft-empty and fail-closed paths without
 * inventing a clean operator-facing catalog external name from padding.
 *
 * Complements open Square catalog tips #946 / MISE-005TH and #945 /
 * MISE-005TG without sharing those modules or rewriting sibling `stringField`
 * call sites. Leave shared `stringField` itself and other
 * normalizeCatalogItem fields (catalog item id, variation id, variation
 * name, product_type, category_id) alone for separate tips.
 */

const MAX_SQUARE_CATALOG_ITEM_EXTERNAL_NAME = 160;

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized catalog item external name before it is
 * stored on durable `SquareCatalogRow.external_name`.
 */
export function asciiTrimSquareCatalogItemExternalName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Square catalog item external name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded,
 * overlong, or containing ASCII controls.
 */
export function canonicalizeSquareCatalogItemExternalName(
  value: string
): string | null {
  const trimmed = asciiTrimSquareCatalogItemExternalName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (trimmed.length > MAX_SQUARE_CATALOG_ITEM_EXTERNAL_NAME) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Square `normalizeCatalogItem` item_data `name` →
 * `external_name`. Preserves soft empty → null (prior `stringField`
 * emptiness → `"Untitled item"` fallback) while refusing to invent a clean
 * catalog external name via Unicode em-space trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `?? "Untitled item"` branch owns the fail-closed fallback without inventing
 * a clean durable name.
 */
export function normalizeSquareCatalogItemExternalName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional `"Untitled item"` fallback. Do not
  // invent a clean catalog external name from padding.
  if (!value.trim()) return null;
  return canonicalizeSquareCatalogItemExternalName(value);
}

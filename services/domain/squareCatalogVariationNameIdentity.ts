/**
 * Square catalog variation name identity helpers (MISE-005TJ).
 *
 * Pins Edge `normalizeCatalogItem` catalog variation
 * `item_variation_data.name` used when composing durable
 * `SquareCatalogRow.external_name` outside the Expo UI graph so Node tests can
 * exercise inventing proofs without loading React Native. The prior path
 * Unicode-trimmed variation `name` through shared `stringField` before
 * composing it into catalog `external_name`
 * (`'\u2003Large\u2003'.trim() === 'Large'` → `"Burger — Large"`), so
 * NBSP/em-space padding invented a clean variation label inside the durable
 * catalog external name used for POS catalog presentation, recipe mapping
 * lookup surfaces, and inventory planning. Soft-empty Unicode-only space also
 * collapsed through `.trim()` into the intentional empty / item-name-only
 * composition path.
 *
 * These are Square **catalog variation name** tokens only — not Square catalog
 * item `name` / `external_name` (#947 / MISE-005TI), not Square catalog item
 * `id` → `external_catalog_item_id` (#946 / MISE-005TH), not Square catalog
 * variation list `id` → `external_variation_id` (#945 / MISE-005TG), not Square
 * order-sale line-item `name` → `item_name` (#941 / MISE-005TC), not Square
 * order-sale line `variation_name` category fallback, not Square location-list
 * display `name`, not Square OAuth `merchant_id` (#944 / MISE-005TF), and not
 * repository Square integration error haystacks (#929 / MISE-005SQ). Soft empty
 * / Unicode-padded / overlong / control-bearing tokens soft-null so padded
 * catalog variation names cannot invent durable composed `external_name`
 * identity. Ordinary ASCII whitespace still trims clean. Case and accents are
 * left unchanged. Soft-empty and fail-closed paths leave composition on the
 * item-name-only branch without inventing a clean variation label.
 *
 * Complements open Square catalog tips #947 / MISE-005TI, #946 / MISE-005TH,
 * and #945 / MISE-005TG without sharing those modules or rewriting sibling
 * `stringField` call sites. Leave shared `stringField` itself and other
 * normalizeCatalogItem fields (catalog item id, item name, variation id,
 * product_type, category_id) alone for separate tips.
 */

const MAX_SQUARE_CATALOG_VARIATION_NAME = 160;

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized catalog variation name before it is
 * composed into durable `SquareCatalogRow.external_name`.
 */
export function asciiTrimSquareCatalogVariationName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Square catalog variation name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded,
 * overlong, or containing ASCII controls.
 */
export function canonicalizeSquareCatalogVariationName(
  value: string
): string | null {
  const trimmed = asciiTrimSquareCatalogVariationName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (trimmed.length > MAX_SQUARE_CATALOG_VARIATION_NAME) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Square `normalizeCatalogItem` variation
 * `item_variation_data.name` composition into `external_name`. Preserves soft
 * empty → null (prior `stringField` emptiness → item-name-only composition)
 * while refusing to invent a clean variation label via Unicode em-space trim.
 * Does not throw; Unicode-padded / unsafe / non-string tokens return null so
 * the live composition keeps the item-name-only branch without inventing a
 * clean durable variation name.
 */
export function normalizeSquareCatalogVariationName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional item-name-only composition path. Do not
  // invent a clean catalog variation name from padding.
  if (!value.trim()) return null;
  return canonicalizeSquareCatalogVariationName(value);
}

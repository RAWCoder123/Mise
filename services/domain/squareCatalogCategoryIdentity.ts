/**
 * Square catalog category identity helpers (MISE-005TN).
 *
 * Pins Edge `normalizeCatalogItem` catalog item `item_data.product_type` /
 * `item_data.category_id` → durable `SquareCatalogRow.category` outside the
 * Expo UI graph so Node tests can exercise inventing proofs without loading
 * React Native. The prior path Unicode-trimmed `product_type` (with
 * `category_id` fallback) through shared `stringField` before storing it on
 * normalized catalog rows (and falling back to `"Square"` on soft empty)
 * (`'\u2003REGULAR\u2003'.trim() === 'REGULAR'`), so NBSP/em-space padding
 * invented a clean catalog category used for POS catalog presentation,
 * recipe mapping lookup surfaces, and inventory planning. Soft-empty
 * Unicode-only padding also collapsed through `.trim()` into the intentional
 * `category_id` / `"Square"` fallback chain.
 *
 * These are Square **catalog category** tokens only — not Square catalog item
 * `name` / `external_name` (#947 / MISE-005TI), not Square catalog item `id` →
 * `external_catalog_item_id` (#946 / MISE-005TH), not Square catalog variation
 * list `id` → `external_variation_id` (#945 / MISE-005TG), not Square catalog
 * variation `name` / composed `external_name` (#948 / MISE-005TJ), not Square
 * order-sale line `variation_name` category fallback (#950 / MISE-005TL), not
 * Square location-list display `name` (#949 / MISE-005TK), not Square OAuth
 * `merchant_id` (#944 / MISE-005TF), and not repository Square integration
 * error haystacks (#929 / MISE-005SQ). Soft empty / Unicode-padded / overlong
 * / control-bearing tokens soft-null so padded catalog category tokens cannot
 * invent durable `category` identity. Ordinary ASCII whitespace still trims
 * clean. Case and accents are left unchanged. The live `|| "Square"` fallback
 * owns soft-empty and fail-closed paths without inventing a clean
 * operator-facing catalog category from padding.
 *
 * Complements open Square catalog tips #948 / MISE-005TJ, #947 / MISE-005TI,
 * #946 / MISE-005TH, and #945 / MISE-005TG without sharing those modules or
 * rewriting sibling `stringField` call sites. Leave shared `stringField`
 * itself and other normalizeCatalogItem fields (catalog item id, item name,
 * variation id, variation name) alone for separate tips. Covers both
 * `product_type` (primary) and `category_id` (fallback) because both feed the
 * same durable `category` through the same prior inventing path.
 */

const MAX_SQUARE_CATALOG_CATEGORY = 80;

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized catalog category before it is stored on
 * durable `SquareCatalogRow.category`.
 */
export function asciiTrimSquareCatalogCategory(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Square catalog category token under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded,
 * overlong, or containing ASCII controls.
 */
export function canonicalizeSquareCatalogCategory(
  value: string
): string | null {
  const trimmed = asciiTrimSquareCatalogCategory(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (trimmed.length > MAX_SQUARE_CATALOG_CATEGORY) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Square `normalizeCatalogItem` `product_type` /
 * `category_id` composition into `category`. Preserves soft empty → null
 * (prior `stringField` emptiness → `category_id` / `"Square"` fallback) while
 * refusing to invent a clean category via Unicode em-space trim. Does not
 * throw; Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| "Square"` chain owns the fail-closed fallback without inventing a clean
 * durable catalog category.
 */
export function normalizeSquareCatalogCategory(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional category_id / "Square" fallback. Do
  // not invent a clean catalog category from padding.
  if (!value.trim()) return null;
  return canonicalizeSquareCatalogCategory(value);
}

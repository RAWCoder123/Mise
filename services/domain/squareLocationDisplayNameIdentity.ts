/**
 * Square location-list display-name identity helpers (MISE-005TK).
 *
 * Pins Edge `listSquareLocations` location `name` → durable
 * `SquareLocation.displayName` outside the Expo UI graph so Node tests can
 * exercise inventing proofs without loading React Native. The prior path
 * Unicode-trimmed location `name` through shared `stringField` before storing
 * `displayName` (and falling back to `"Square location"` on soft empty)
 * (`'\u2003Main Floor\u2003'.trim() === 'Main Floor'`), so NBSP/em-space
 * padding invented a clean location display label used for POS location
 * presentation, operator location pickers, and inventory planning surfaces.
 * Soft-empty Unicode-only padding also collapsed through `.trim()` into the
 * intentional `"Square location"` fallback.
 *
 * These are Square location-list **displayName** tokens only — not Square
 * location-list `id` → `externalLocationId` (#943 / MISE-005TE), not Square
 * order-sale `provider_location_id` (#938 / MISE-005SZ), not hosted
 * verified-provider mapping `providerLocationId` hydrate (#936 / MISE-005SX),
 * not Square OAuth `merchant_id` (#944 / MISE-005TF), not Square catalog item
 * `name` / `external_name` (#947 / MISE-005TI), not Square catalog variation
 * `name` (#948 / MISE-005TJ), not Square order-sale line-item `name` →
 * `item_name` (#941 / MISE-005TC), and not repository Square integration
 * error haystacks (#929 / MISE-005SQ). Soft empty / Unicode-padded /
 * overlong / control-bearing tokens soft-null so padded names cannot invent
 * a clean durable `displayName`. Ordinary ASCII whitespace still trims clean.
 * Case and accents are left unchanged. The live `?? "Square location"`
 * fallback owns soft-empty and fail-closed paths without inventing a clean
 * operator-facing location label from padding.
 *
 * Complements open Square location / catalog tips #948 / MISE-005TJ, #947 /
 * MISE-005TI, #943 / MISE-005TE, #938 / MISE-005SZ, and #936 / MISE-005SX
 * without sharing those modules or rewriting sibling `stringField` call
 * sites. Leave shared `stringField` itself and other listSquareLocations
 * fields (location `id` → `externalLocationId`, timezone) alone for separate
 * tips.
 */

const MAX_SQUARE_LOCATION_DISPLAY_NAME = 200;

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized location display name before it is stored
 * on durable `SquareLocation.displayName`.
 */
export function asciiTrimSquareLocationDisplayName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Square location-list display name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded,
 * overlong, or containing ASCII controls.
 */
export function canonicalizeSquareLocationDisplayName(
  value: string
): string | null {
  const trimmed = asciiTrimSquareLocationDisplayName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (trimmed.length > MAX_SQUARE_LOCATION_DISPLAY_NAME) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Square `listSquareLocations` location `name` →
 * `displayName`. Preserves soft empty → null (prior `stringField` emptiness →
 * `"Square location"` fallback) while refusing to invent a clean location
 * label via Unicode em-space trim. Does not throw; Unicode-padded / unsafe /
 * non-string tokens return null so the live `?? "Square location"` branch
 * owns the fail-closed fallback without inventing a clean durable name.
 */
export function normalizeSquareLocationDisplayName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional `"Square location"` fallback. Do not
  // invent a clean location display name from padding.
  if (!value.trim()) return null;
  return canonicalizeSquareLocationDisplayName(value);
}

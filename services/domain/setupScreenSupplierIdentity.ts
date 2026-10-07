/**
 * ASCII C-locale supplier identity for the auth setup screen
 * (`app/(auth)/setup.tsx`) — MISE-005KA.
 *
 * Mirrors the application-layer setup tip (MISE-005JK / #680): only ASCII A–Z
 * is case-folded, and only ASCII whitespace is trimmed / collapsed. Unicode
 * `toLocaleLowerCase("en-US")` would map Kelvin sign `K` → `k` and invent a
 * duplicate-supplier or mailbox match the hosted COLLATE "C" path would refuse.
 *
 * Does not re-tip `services/application/setup.ts` (#679 / #680), Settings
 * suppliers UI (#690 / #691), or durable SQL `normalize_supplier_name` (#410).
 */

/** ASCII C-locale case fold — mirrors SQL `lower(... collate "C")`. */
function asciiCLower(value: string) {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

/**
 * Trim only ASCII whitespace so setup-screen supplier keys stay aligned with
 * server helpers that btrim under COLLATE "C".
 */
function asciiCTrim(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

/** Collapse interior ASCII whitespace; fold NBSP to a plain space first. */
const C_WHITESPACE = /[ \t\n\v\f\r]+/g;

/** ASCII controls under C locale `[[:cntrl:]]` (0x00–0x1F and DEL). */
const asciiCControl = /[\u0000-\u001f\u007f]/;

/**
 * ASCII C mailbox shape — mirrors SQL
 *   email collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 * Uses an explicit ASCII whitespace class instead of Unicode `\s`.
 */
const asciiCMailboxShape =
  /^[^ \t\n\r\f\v@]+@[^ \t\n\r\f\v@]+\.[^ \t\n\r\f\v@]+$/;

const SETUP_SCREEN_SUPPLIER_NAME_MAX_CHARACTERS = 160;

/**
 * Display prep for setup-screen supplier names: NBSP → space, collapse C
 * whitespace, ASCII trim. Preserves accents and case for operator messages.
 */
export function canonicalSetupScreenSupplierDisplayName(value: string) {
  return asciiCTrim(
    value.replace(/\u00a0/g, " ").replace(C_WHITESPACE, " ")
  );
}

/**
 * Setup-screen supplier-name identity key used for client-side duplicate
 * detection before calling `saveRestaurantSetup`.
 */
export function normalizeSetupScreenSupplierNameKey(value: string) {
  return asciiCLower(canonicalSetupScreenSupplierDisplayName(value));
}

export function setupScreenSupplierNameKeysMatch(left: string, right: string) {
  return (
    normalizeSetupScreenSupplierNameKey(left) ===
    normalizeSetupScreenSupplierNameKey(right)
  );
}

/** Local gate for setup-screen supplier display names. */
export function isValidSetupScreenSupplierDisplayName(value: string) {
  const canonical = canonicalSetupScreenSupplierDisplayName(value);
  return (
    canonical.length >= 1 &&
    canonical.length <= SETUP_SCREEN_SUPPLIER_NAME_MAX_CHARACTERS &&
    !asciiCControl.test(value)
  );
}

/**
 * Optional supplier email normalize for setup-screen validation. Empty input
 * is null; invalid shape returns null so the screen can show its own copy.
 */
export function normalizeSetupScreenOptionalEmail(value: string) {
  const normalized = asciiCTrim(asciiCLower(value));
  if (!normalized) return null;
  if (asciiCControl.test(normalized)) return null;
  if (!asciiCMailboxShape.test(normalized)) return null;
  if (normalized.length < 3 || normalized.length > 254) return null;
  return normalized;
}

export function isValidSetupScreenSupplierEmail(value: string) {
  return normalizeSetupScreenOptionalEmail(value) !== null;
}

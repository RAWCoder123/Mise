/**
 * ASCII C-locale case fold — mirrors SQL `lower(... collate "C")`
 * (MISE-005JU). Only ASCII A-Z is folded; Unicode-aware `toLowerCase`
 * would map Kelvin sign `K` → `k` and invent a suppliers-settings
 * draft-email equality the hosted COLLATE C recipient path would refuse.
 */
function asciiCLower(value: string) {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

/**
 * Trim only ASCII whitespace so suppliers-settings draft mailboxes stay
 * aligned with server helpers that btrim under COLLATE "C".
 */
function asciiCTrim(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

/**
 * ASCII C mailbox shape — mirrors SQL
 *   email collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 * Uses an explicit ASCII whitespace class instead of Unicode `\s`.
 */
const asciiCMailboxShape =
  /^[^ \t\n\r\f\v@]+@[^ \t\n\r\f\v@]+\.[^ \t\n\r\f\v@]+$/;

/**
 * Identity key used to decide whether a suppliers-settings draft email is
 * unchanged versus the saved recipient mailbox.
 */
export function normalizeSupplierSettingsEmailKey(value: string) {
  return asciiCLower(asciiCTrim(value));
}

export function supplierSettingsEmailsMatch(left: string, right: string) {
  return (
    normalizeSupplierSettingsEmailKey(left) ===
    normalizeSupplierSettingsEmailKey(right)
  );
}

/**
 * Prepare a draft mailbox before save / local validation. ASCII C trim +
 * case fold so Kelvin lookalikes are not invented and NBSP is not treated
 * as space.
 */
export function normalizeSupplierSettingsRecipientEmail(value: string) {
  return normalizeSupplierSettingsEmailKey(value);
}

/** Local gate for suppliers-settings Save before the service validation layer. */
export function isValidSupplierSettingsRecipientEmail(value: string) {
  const email = normalizeSupplierSettingsRecipientEmail(value);
  return (
    email.length >= 3 &&
    email.length <= 254 &&
    asciiCMailboxShape.test(email)
  );
}

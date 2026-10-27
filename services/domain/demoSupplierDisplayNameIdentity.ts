/**
 * Demo supplier display-name helpers (MISE-005SB).
 *
 * Pins `services/demo/demoSupplierIdentity.ts` `normalizeDemoSupplierDisplayName`
 * / `demoSupplierNormalizedName` prep outside Expo/AsyncStorage so Node tests
 * can exercise inventing proofs. The prior path Unicode-trimmed, then collapsed
 * Unicode `\s+` into a single space, before storing `display_name` /
 * `normalized_name` and deriving durable legacy supplier UUIDs
 * (`'\u2003Acme Foods\u2003'.trim().replace(/\s+/g, " ") === 'Acme Foods'`, and
 * `'Acme\u2003Foods'.replace(/\s+/g, " ") === 'Acme Foods'`). Soft empty /
 * Unicode-only space also invented the invalid-name branch via
 * `'\u2003'.trim() === ''`. Discovery lowercasing used `toLocaleLowerCase("en-US")`,
 * which can invent Kelvin-sign collapses the hosted COLLATE "C" path would not.
 *
 * These are demo supplier **display-name / discovery-key** strings only — not
 * hosted `requireSupplierDisplayName` / recipient directory prep (open #692 /
 * MISE-005JW), not Settings suppliers rename identity (open #691 / MISE-005JV),
 * not SQL display_name cntrl CHECKs (open #430 / MISE-005V), and not demo
 * supplier-send subject / mailbox tips (open #913 / #708). Soft empty (ASCII
 * whitespace or Unicode-only space) still throws the prior
 * `Enter a valid supplier name.` contract. Ordinary ASCII whitespace still
 * trims / collapses clean before the length gate. Unicode end padding,
 * remaining non-C whitespace that prior `\s+` would invent into spaces, and
 * ASCII controls fail closed with the same message so padded names cannot
 * invent a reviewed durable identity or legacy UUID.
 *
 * Complements open hosted display-name tip #692 / MISE-005JW without sharing
 * that module. Leave miseValidation / supplierRecipients alone until #692 owns
 * those surfaces on main.
 */

const DEMO_SUPPLIER_NAME_MAX_CHARACTERS = 160;
const C_WHITESPACE = /[ \t\n\v\f\r]+/g;

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized demo supplier display name before durable
 * display_name / normalized_name / legacy UUID derivation.
 */
export function asciiTrimDemoSupplierDisplayName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

/**
 * Fold only ASCII A–Z. Unicode-aware `toLocaleLowerCase("en-US")` can invent
 * Kelvin-sign discovery-key collapses hosted COLLATE "C" lower would refuse.
 */
export function asciiCLowerDemoSupplierDisplayName(value: string) {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Collapse NBSP and C-locale whitespace the way hosted display-name prep does,
 * without Unicode `\s` inventing em-space equality.
 */
function collapseDemoSupplierDisplayNameWhitespace(value: string) {
  return value.replace(/\u00a0/g, " ").replace(C_WHITESPACE, " ");
}

/**
 * Canonicalize a demo supplier display name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, containing
 * ASCII controls, still holding non-C whitespace that prior Unicode `\s+`
 * would invent into spaces, or outside the 1..160 character bound. Otherwise
 * returns the ASCII-trimmed, C-collapsed display name for durable demo rows.
 */
export function canonicalizeDemoSupplierDisplayName(value: string): string | null {
  const trimmed = asciiTrimDemoSupplierDisplayName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  const collapsed = collapseDemoSupplierDisplayNameWhitespace(trimmed);
  // Fail closed when prior Unicode `\s+` collapse would still invent spaces
  // from remaining non-C whitespace (for example internal em-space).
  if (collapsed.replace(/\s+/g, " ") !== collapsed) return null;
  if (collapsed.length < 1 || collapsed.length > DEMO_SUPPLIER_NAME_MAX_CHARACTERS) {
    return null;
  }
  return collapsed;
}

/**
 * Fail-closed normalize for demo supplier display-name identity.
 * Soft empty (ASCII whitespace or Unicode-only space) and inventing /
 * control-bearing / over-long tokens throw the prior
 * `Enter a valid supplier name.` contract. Ordinary ASCII whitespace still
 * trims and C-collapses clean.
 */
export function normalizeCanonicalDemoSupplierDisplayName(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Enter a valid supplier name.");
  }
  // Soft empty for ASCII whitespace or Unicode-only space: prior `.trim()`
  // emptied those into the length < 1 branch.
  if (!value.trim()) {
    throw new Error("Enter a valid supplier name.");
  }
  if (hasControlCharacters(value)) {
    throw new Error("Enter a valid supplier name.");
  }
  const canonical = canonicalizeDemoSupplierDisplayName(value);
  if (!canonical) {
    throw new Error("Enter a valid supplier name.");
  }
  return canonical;
}

/**
 * Demo discovery-key lowercasing under ASCII C. Applies display-name
 * canonicalize first, then folds only ASCII A–Z so Kelvin-sign locale folds
 * cannot invent a normalized_name / legacy UUID identity.
 */
export function normalizeDemoSupplierDiscoveryName(value: unknown): string {
  return asciiCLowerDemoSupplierDisplayName(
    normalizeCanonicalDemoSupplierDisplayName(value)
  );
}

export { DEMO_SUPPLIER_NAME_MAX_CHARACTERS };

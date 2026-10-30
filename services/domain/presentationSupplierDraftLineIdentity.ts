/**
 * Supplier draft line label identity helpers (MISE-005UH).
 *
 * Pins `utils/orderPresentation` supplier-draft `itemName` / `quantityLabel`
 * prep (and the raw line trim that feeds them) outside the Expo UI graph so
 * Node tests can exercise inventing proofs without loading React Native.
 * Prior draft-line scanning Unicode-trimmed each message line and each
 * capture group before storing presentation chrome
 * (`'\u2003Tomatoes\u2003'.trim() === 'Tomatoes'`,
 * `'\u20035 cases\u2003'.trim() === '5 cases'`, and
 * `'\u2003Tomatoes - 5 cases\u2003'.trim() === 'Tomatoes - 5 cases'`), so
 * NBSP/em-space padding invented clean supplier-draft item and quantity
 * labels rendered into Orders draft cards and used for estimate matching.
 *
 * These are presentation **supplier draft line labels** only — not Login
 * email chip labels (#971 / MISE-005UG), not Insights profile cuisine-type
 * (#970 / MISE-005UF) or restaurant-name (#969 / MISE-005UE), not Today
 * screen title restaurant-name (#968 / MISE-005UD), not restaurant branding
 * initials (#967 / MISE-005UC), not Settings account email (#966 /
 * MISE-005UB), not Team directory labels (#965 / MISE-005UA), not
 * More/Settings profile name (#964 / MISE-005TZ), not Create Task assignee
 * labels (#963 / MISE-005TY), not purchase-line `normalized_item_key`
 * (MISE-005A), and not supplier-send content `itemName` validation in
 * `miseValidation`. Soft empty / Unicode-padded / control-bearing tokens
 * soft-null so padded draft lines cannot invent clean item/quantity chrome;
 * the scanner skips soft-nulled lines instead of inventing identity from
 * padding. Ordinary ASCII whitespace still trims clean. Case and accents
 * are left unchanged.
 *
 * Complements open presentation tips through #971 without sharing those
 * modules or rewriting purchase-key / supplier-send validation paths.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized supplier draft line label before it is
 * stored in Orders draft presentation.
 */
export function asciiTrimPresentationSupplierDraftLineLabel(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a supplier draft line label token under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizePresentationSupplierDraftLineLabel(
  value: string
): string | null {
  const trimmed = asciiTrimPresentationSupplierDraftLineLabel(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize one supplier draft line label candidate (raw line, item
 * name, or quantity label). Preserves soft empty → null (prior `.trim()`
 * emptiness → skip line) while refusing to invent a clean label via
 * Unicode em-space trim. Does not throw; Unicode-padded / unsafe /
 * non-string tokens return null so the scanner can skip the line without
 * inventing clean draft-line identity from padding.
 */
export function normalizePresentationSupplierDraftLineLabel(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into a skipped line. Do not invent a draft label from
  // padding.
  if (!value.trim()) return null;
  return canonicalizePresentationSupplierDraftLineLabel(value);
}

/**
 * Resolve a supplier draft item-name label under ASCII C.
 */
export function presentationSupplierDraftItemName(
  value: string | null | undefined
): string | null {
  return normalizePresentationSupplierDraftLineLabel(value);
}

/**
 * Resolve a supplier draft quantity label under ASCII C.
 */
export function presentationSupplierDraftQuantityLabel(
  value: string | null | undefined
): string | null {
  return normalizePresentationSupplierDraftLineLabel(value);
}

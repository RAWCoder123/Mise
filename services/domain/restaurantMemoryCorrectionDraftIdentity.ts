/**
 * Restaurant-memory UI correction-draft free-text helpers (MISE-005PN).
 *
 * Pins the restaurant-memory screen correction draft outside the repository
 * graph so Node tests can exercise inventing proofs without loading
 * AsyncStorage. The UI previously Unicode-trimmed
 * `(correctionDrafts[id] ?? memory.statement).trim()` before emptiness checks
 * and `updateRestaurantMemoryDecision`, so NBSP/em-space padding invented a
 * clean free-text correction before the decision path received it
 * (`'\u2003Friday dinner runs hot on chicken\u2003'.trim() ===
 * 'Friday dinner runs hot on chicken'`).
 *
 * Correction drafts are multiline operator free-text (parity with supplier
 * `operator_note` / open SQL cntrl pin #553/#672 / MISE-005OS count-line note /
 * MISE-005OT error / MISE-005OU lesson / MISE-005OO restaurant-tasks detail /
 * MISE-005OP completionResult / MISE-005OW evidence summary /
 * MISE-005OX recommendedAction / MISE-005PA delivery notes /
 * MISE-005PB waste notes / MISE-005PC deliveryHistory notes /
 * MISE-005PE floor-notes body / MISE-005PF operator_note /
 * MISE-005PM order-message Notes: / MISE-005EP):
 * fold NBSP to a plain space, then trim only C-locale `[[:space:]]` from the
 * ends. Do not collapse internal whitespace with `\s` or Unicode
 * `String#trim`, so internal LF/TAB/CR survive and em-space padding cannot
 * invent equality with an unpadded correction. Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks operators need in corrections.
 *
 * Complements open restaurant-memory statement tip #830 / MISE-005OV (domain
 * statement create/correct / hydrate correction preference) and scope/source
 * tip #841 / MISE-005PG without sharing their helper modules or rewriting
 * those paths. Intentionally does not change domain `createMemory` /
 * `correctMemory` / `restaurantMemoryFromPersistedRow`, learning-signal
 * filters, or user profile display-name trim.
 *
 * Soft empty after prep stays `null` so the UI can keep showing
 * `memory.notice.correctionRequired` for blank drafts. Soft canonicalize does
 * not soft-truncate; domain statement bounds remain owned by #830.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for restaurant-memory correction drafts. Folds NBSP,
 * C-whitespace-trims ends only. Does not Unicode-trim or collapse with `\s`,
 * so em-space padding cannot invent equality with an unpadded correction and
 * internal newlines stay intact.
 */
export function canonicalRestaurantMemoryCorrectionDraft(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft canonicalize for the restaurant-memory UI correction draft. Preserves
 * soft empty → `null` (prior `.trim()` empty → correctionRequired contract)
 * while refusing to invent a clean correction via Unicode em-space trim. Does
 * not throw; does not soft-truncate (domain statement bounds stay with open
 * statement tip #830).
 */
export function canonicalizeRestaurantMemoryCorrectionDraft(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent a one-character correction.
  if (!value.trim()) return null;
  const canonical = canonicalRestaurantMemoryCorrectionDraft(value);
  if (!canonical) return null;
  return canonical;
}

/**
 * Fail-closed correction-draft normalize for inventing proofs. Soft empty →
 * `null`. Unsafe-control / non-string tokens fail with distinct messages.
 *
 * Error contracts:
 * - non-string / unsafe control → `Restaurant memory correction must be text.`
 */
export function normalizeCanonicalRestaurantMemoryCorrectionDraft(
  value: unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Restaurant memory correction must be text.");
  }
  if (hasUnsafeMultilineControls(value)) {
    throw new Error("Restaurant memory correction must be text.");
  }
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent a one-character correction.
  if (!value.trim()) return null;
  const prepared = canonicalRestaurantMemoryCorrectionDraft(value);
  if (!prepared) return null;
  return prepared;
}

/**
 * Fail-closed correction-draft require for focused inventing proofs.
 * Preserves a distinct message from sibling tips:
 * `Restaurant memory correction must be text.`
 */
export function requireCanonicalRestaurantMemoryCorrectionDraft(
  value: unknown
): string {
  const normalized = normalizeCanonicalRestaurantMemoryCorrectionDraft(value);
  if (!normalized) {
    throw new Error("Restaurant memory correction must be text.");
  }
  return normalized;
}

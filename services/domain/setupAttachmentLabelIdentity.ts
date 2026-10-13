/**
 * Setup attachment label identity helpers (MISE-005PI).
 *
 * Pins application-layer `saveRestaurantSetup` attachment labels outside the
 * repository graph so Node tests can exercise inventing proofs without loading
 * Supabase or demo storage. Setup attachment labels previously Unicode-trimmed
 * on persist (`attachment.label.trim() || "Setup reference"`), so NBSP/em-space
 * padding invented a clean durable label before `setup_attachments` stored it
 * (`'\u2003Menu CSV\u2003'.trim() === 'Menu CSV'`). Soft-empty Unicode-only
 * padding also collapsed through `.trim()` into the intentional
 * `"Setup reference"` default.
 *
 * Complements open setup_attachments.label SQL cntrl pin #652 / MISE-005IJ
 * without sharing its migration or rewriting that require helper. Intentionally
 * does not change `normalizeSetupAttachment` (`asString` fallback without trim),
 * setupDrafts readiness emptiness, `requireRestaurantName`, session
 * `profile.name?.trim()`, or other setup draft field trims. Those remain on
 * their existing contracts in this tip.
 *
 * Attachment labels are single-line setup reference identity text, not
 * free-form multiline prose. Only ASCII end trim is pinned; case and accents
 * are left unchanged so presentation stays operator-faithful. Soft empty
 * (ASCII whitespace or Unicode-only space) stays soft-null so save can fall
 * through to the prior `"Setup reference"` default without inventing that
 * default from a padded real token. Unicode-padded non-empty tokens fail
 * closed rather than inventing equality with the unpadded label.
 */

export const SETUP_ATTACHMENT_LABEL_DEFAULT = "Setup reference";

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized setup attachment label before it is
 * stored as durable setup reference identity.
 */
export function asciiTrimSetupAttachmentLabelToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a setup attachment label under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeSetupAttachmentLabelToken(
  value: string
): string | null {
  const trimmed = asciiTrimSetupAttachmentLabelToken(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft canonicalize for callers that preserve soft empty → null (prior
 * `.trim() || "Setup reference"` emptiness) while refusing to invent a clean
 * label via Unicode em-space trim. Does not throw; Unicode-padded non-empty
 * tokens return null so the live fail-closed normalize owns the error.
 */
export function canonicalizeSetupAttachmentLabel(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent a label from padding.
  if (!value.trim()) return null;
  return canonicalizeSetupAttachmentLabelToken(value);
}

/**
 * Fail-closed label normalize for `saveRestaurantSetup` and inventing proofs.
 * Soft empty → null so save can apply the `"Setup reference"` default.
 * Unicode-padded / unsafe-control / non-string tokens fail closed.
 *
 * Error contract: `Setup attachment label is invalid.`
 */
export function normalizeCanonicalSetupAttachmentLabel(
  value: unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Setup attachment label is invalid.");
  }
  const canonical = canonicalizeSetupAttachmentLabelToken(value);
  if (canonical) return canonical;
  // Preserve soft empty (ASCII whitespace or Unicode-only space) → null.
  if (!value.trim()) return null;
  throw new Error("Setup attachment label is invalid.");
}

/**
 * Fail-closed label require for inventing proofs where a present label must
 * already be canonical. Soft empty fails closed rather than inventing the
 * save-time `"Setup reference"` default on read.
 */
export function requireCanonicalSetupAttachmentLabel(value: unknown): string {
  const canonical = normalizeCanonicalSetupAttachmentLabel(value);
  if (!canonical) {
    throw new Error("Setup attachment label is invalid.");
  }
  return canonical;
}

/**
 * Demo supplier-send subject helpers (MISE-005SA).
 *
 * Pins `services/domain/supplierSendContent.ts` `normalizedSubject` prep
 * outside the repository graph so Node tests can exercise inventing proofs
 * without loading Expo. The prior path built
 * `${restaurantName} order for ${supplierName}`, collapsed CR/LF runs, then
 * Unicode-trimmed before storing `subject` on the durable demo send snapshot
 * and content fingerprint (`'\u2003Harbor Kitchen order for Acme Foods\u2003'
 * .trim() === 'Harbor Kitchen order for Acme Foods'`, and leading em-space on
 * `restaurantName` likewise invents a clean subject start). Soft empty /
 * Unicode-only space also invented the invalid-subject / null branch via
 * `'\u2003'.trim() === ''`.
 *
 * These are demo supplier-send **subject** strings only — not From/To mailbox
 * identity (open #708 / MISE-005KM), not supplier-recipient / preview email
 * (open #681 / MISE-005JL), not SQL subject COLLATE pins (open #425 /
 * MISE-005Q), and not order-message Notes: prep (open #847 / MISE-005PM). Soft
 * empty (ASCII whitespace or Unicode-only space) stays `null` so callers keep
 * the prior `send_subject_invalid` contract. Ordinary ASCII whitespace still
 * trims clean before the length / control gates. Unicode-padded or
 * control-bearing subjects fail closed as `null` so padded subjects cannot
 * invent a reviewed fingerprint identity.
 *
 * Complements open demo mailbox tip #708 / MISE-005KM without sharing that
 * module. Leave `normalizedEmail` / `normalizeSupplierSendEmail` alone until
 * #708 owns that surface on main.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized supplier-send subject before the durable
 * demo snapshot / content fingerprint.
 */
export function asciiTrimSupplierSendSubject(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a demo supplier-send subject under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, containing
 * ASCII controls, or outside the 1..500 character bound. Otherwise returns
 * the ASCII-trimmed subject for the durable snapshot.
 */
export function canonicalizeSupplierSendSubject(value: string): string | null {
  const trimmed = asciiTrimSupplierSendSubject(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  if (trimmed.length < 1 || trimmed.length > 500) return null;
  return trimmed;
}

/**
 * Soft normalize for demo supplier-send subject identity.
 * Preserves soft empty → `null` (prior `.trim()` emptiness →
 * `send_subject_invalid`) while refusing to invent a clean subject via
 * Unicode em-space / NBSP trim. Non-string, control-bearing, and
 * Unicode-padded tokens soft to `null`.
 */
export function normalizeSupplierSendSubject(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  if (value === "") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the invalid-subject branch.
  if (!value.trim()) return null;
  return canonicalizeSupplierSendSubject(value);
}

/**
 * Build the durable demo supplier-send subject from restaurant + supplier
 * display names under ASCII C. Collapses CR/LF runs first (prior contract),
 * then routes through `normalizeSupplierSendSubject` so Unicode end padding
 * cannot invent a clean fingerprint identity.
 */
export function buildSupplierSendSubject(
  restaurantName: string,
  supplierName: string
): string | null {
  const subject = `${restaurantName} order for ${supplierName}`.replace(/[\r\n]+/g, " ");
  return normalizeSupplierSendSubject(subject);
}

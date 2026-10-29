/**
 * Outreach webhook From-header mailbox identity helpers (MISE-005TU).
 *
 * Pins Edge `outreach-webhook` `extractEmail` non-bracketed From-header
 * prep outside the Expo UI graph so Node tests can exercise inventing
 * proofs without loading React Native. The prior path Unicode-trimmed the
 * raw From value before `normalizeOutreachEmail` and lead
 * `email_normalized` matching
 * (`'\u2003chef@joescafe.com\u2003'.trim() === 'chef@joescafe.com'`), so
 * NBSP/em-space padding invented a clean durable mailbox used to stop
 * follow-ups and mark leads/enrollments/messages as replied. Soft-empty /
 * Unicode-only padding also collapsed through `.trim()` into the
 * intentional empty → null fail path.
 *
 * These are outreach-webhook **non-bracketed From mailbox candidates**
 * only — not domain `normalizeOutreachEmail` / COLLATE C
 * `email_normalized` (#420 / MISE-005L), not outreach lead `requireText`
 * (#873 / MISE-005QM), not outreach draft `requireBoundedText` (#874 /
 * MISE-005QN), not suppliers-settings draft email (#690 / MISE-005JU),
 * not supplier-recipient email (#681 / MISE-005JL), not login email
 * (#876 / MISE-005QP), not beta provisioning email (#707 / MISE-005KL),
 * and not greeting `firstName`. Soft empty / Unicode-padded / overlong /
 * control-bearing tokens soft-null so padded From headers cannot invent
 * durable reply-stop mailbox identity. Ordinary ASCII whitespace still
 * trims clean. Case and accents are left unchanged here; durable case
 * fold remains owned by `normalizeOutreachEmail` (#420).
 *
 * Complements open outreach email_normalized tip #420 / MISE-005L and
 * outreach lead text tip #873 / MISE-005QM without sharing those modules
 * or rewriting `normalizeOutreachEmail` / angle-bracket capture paths.
 * Leave `normalizeOutreachEmail`, bracketed `<...>` captures, and sibling
 * outreach identity helpers alone for their separate tips.
 */

const MAX_OUTREACH_WEBHOOK_FROM_MAILBOX = 320;

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized mailbox before outreach lead matching.
 * Email/mailbox tips preserve NBSP as non-space.
 */
export function asciiTrimOutreachWebhookFromMailbox(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a non-bracketed outreach-webhook From mailbox under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded,
 * overlong, or containing ASCII controls.
 */
export function canonicalizeOutreachWebhookFromMailbox(
  value: string
): string | null {
  const trimmed = asciiTrimOutreachWebhookFromMailbox(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (trimmed.length > MAX_OUTREACH_WEBHOOK_FROM_MAILBOX) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for outreach-webhook `extractEmail` non-bracketed From
 * values. Preserves soft empty → null (prior `.trim()` emptiness → null
 * after `normalizeOutreachEmail` / mailbox regex) while refusing to invent
 * a clean durable mailbox via Unicode em-space trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so
 * `stopFollowUpsForReply` keeps its intentional no-op without inventing a
 * clean lead mailbox from padding.
 */
export function normalizeOutreachWebhookFromMailbox(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional null mailbox path. Do not invent
  // a mailbox from padding.
  if (!value.trim()) return null;
  return canonicalizeOutreachWebhookFromMailbox(value);
}

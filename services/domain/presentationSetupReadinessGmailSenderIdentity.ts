/**
 * Setup-readiness Email step `sender_email` helpers (MISE-005VW).
 *
 * Pins `buildSetupReadinessSummary` email readiness that previously decided
 * missing/complete and selected detail text with a raw truthy /
 * nullish-coalescing gate:
 *
 * ```ts
 * const missingEmailSender =
 *   emailConnection?.status !== "connected" || !emailConnection.sender_email;
 * detail: missingEmailSender
 *   ? "Gmail sender not linked"
 *   : emailConnection.sender_email ?? "Gmail ready";
 * ```
 *
 * A Unicode-only-space sender_email (`"\u2003"`) is truthy under
 * `!emailConnection.sender_email` and non-nullish under `??`, so a connected
 * Gmail row with only padding was marked complete and rendered the padding
 * (or bypassed the intentional hard-coded `"Gmail ready"` empty-state) instead
 * of failing closed to `"Gmail sender not linked"`. Empty string has the same
 * `??` bypass if it ever reached the complete branch. Separately, Unicode
 * `.trim()` on padded sender mailboxes
 * (`"\u2003orders@harbor.kitchen\u2003".trim() === "orders@harbor.kitchen"`)
 * would invent a clean setup-readiness mailbox identity.
 *
 * Mailbox tips preserve NBSP: ASCII end trim only — do not fold NBSP into a
 * plain space. Soft-null when Unicode trim would still strip end padding
 * (NBSP / em-space) so padding cannot invent equality with an unpadded
 * mailbox. Accents and case are preserved. Single-line mailbox identity uses
 * full C0/DEL control rejection (no LF/TAB/CR allowlist); multiline free-text
 * note/body display stays on open #1013 / #1014 / #840.
 *
 * These are setup-readiness Email-step `sender_email` tokens only — the
 * `buildSetupReadinessSummary` missing/complete gate and hard-coded English
 * `"Gmail sender not linked"` / `"Gmail ready"` detail. Not Settings/Gmail
 * connection detail sender (#1019 / presentationGmailSenderEmailIdentity),
 * not Orders gmail connected-body sender (#1020 /
 * presentationOrdersGmailSenderIdentity), not Orders detail email-review
 * From/To/Subject (#1015), not Settings account email labels (#966), not
 * outreach-webhook From mailbox (#959), not durable demo supplier-send
 * From/To (#708), not `buildSupplierEmailPayload` `from` pass-through, not
 * pilot-readiness `sender_email?.trim()` gating, and not DB COLLATE C
 * sender_email shape pins (#423 / #653). Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live `"Gmail sender not linked"` /
 * `"Gmail ready"` branches own the intentional empty states. Ordinary ASCII
 * whitespace still trims clean.
 *
 * Complements open #1030 / #1029 / #1020 / #1019 / #1015 / #966 / #959 / #708 /
 * #423 / #653 on other presentation / shape tips without sharing those
 * modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized setup-readiness Gmail sender_email before
 * it is rendered into the Email step detail.
 */
export function asciiTrimSetupReadinessGmailSender(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a setup-readiness Email-step sender_email under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeSetupReadinessGmailSender(value: string): string | null {
  const trimmed = asciiTrimSetupReadinessGmailSender(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize one setup-readiness Email-step sender_email candidate.
 * Preserves soft empty → null (intentional hard-coded
 * `"Gmail sender not linked"` / `"Gmail ready"` copy) while refusing to invent
 * a clean mailbox via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * missing/complete gate and detail branches own the fallback without inventing
 * a clean sender mailbox from padding, without letting truthy Unicode-only
 * space mark Email complete, and without letting non-nullish Unicode-only
 * space or empty string bypass `"Gmail ready"` through the prior `??` row.
 */
export function normalizeSetupReadinessGmailSender(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): truthy padding
  // previously marked Email complete under `!sender_email`, and non-nullish
  // padding bypassed `"Gmail ready"` via `??`. Do not invent a clean
  // setup-readiness Gmail sender mailbox from padding.
  if (!value.trim()) return null;
  return canonicalizeSetupReadinessGmailSender(value);
}

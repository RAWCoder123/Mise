/**
 * Orders detail email-review from/to/subject `orders.detail.review.unavailable`
 * display helpers (MISE-005VG).
 *
 * Pins the Orders detail draft email-review header rows that previously
 * selected display text with nullish coalescing before the intentional
 * localized fallback:
 * `visibleEmailPayload?.from ?? t("orders.detail.review.unavailable")`
 * (and the matching `to` / `subject` rows).
 *
 * A Unicode-only-space header (`"\u2003"`) is non-nullish
 * (`("\u2003" ?? FALLBACK) === "\u2003"`), so the intentional
 * `orders.detail.review.unavailable` copy was bypassed and the review panel
 * could render a blank-looking From / To / Subject row. Empty string has the
 * same `??` bypass (`("" ?? FALLBACK) === ""`). Separately, Unicode
 * `.trim()` on padded mailbox / subject headers
 * (`"\u2003chef@harbor.kitchen\u2003".trim() === "chef@harbor.kitchen"`)
 * would invent a clean display header if that gate Unicode-trimmed before
 * interpolation.
 *
 * Mailbox / header tips preserve NBSP: ASCII end trim only — do not fold
 * NBSP into a plain space. Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded mailbox or subject. Accents and case are preserved. Single-line
 * header identity uses full C0/DEL control rejection (no LF/TAB/CR allowlist);
 * multiline free-text body display stays on open #1014 / MISE-005VF.
 *
 * These are presentation **orders.detail.review.unavailable** from / to /
 * subject display tokens only — not email-review body (#1014), not sent-note
 * `orders.detail.note.none` (#1013), not supplier operator_note write/persist
 * (#840), not `generatedOrderMessage` display trim, not durable demo
 * supplier-send From/To mailbox identity (#708), not demo supplier-send
 * subject identity (#913), not Settings account email labels (#966), not
 * outreach-webhook From mailbox (#959), not Orders delivery-evidence
 * timezone (#1010), and not receive-discrepancy (#670). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("orders.detail.review.unavailable")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1014 / #1013 / #840 / #1010 / #670 / #708 / #913 on
 * Orders / supplier-send paths without sharing those modules or rewriting
 * their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized email-review header before it is rendered
 * into the Orders detail review panel.
 */
export function asciiTrimOrdersDetailEmailReviewHeader(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an email-review from / to / subject display token under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeOrdersDetailEmailReviewHeader(
  value: string
): string | null {
  const trimmed = asciiTrimOrdersDetailEmailReviewHeader(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize one Orders detail email-review from / to / subject display
 * candidate. Preserves soft empty → null (intentional localized
 * orders.detail.review.unavailable copy) while refusing to invent a clean
 * mailbox or subject via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("orders.detail.review.unavailable")` branch owns the fallback without
 * inventing a clean header identity from padding, and without letting
 * non-nullish Unicode-only space or empty string bypass that fallback through
 * the prior `??` rows.
 */
export function normalizeOrdersDetailEmailReviewHeader(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously bypassed the intentional localized review.unavailable copy via
  // `??`. Do not invent a clean From / To / Subject header from padding.
  if (!value.trim()) return null;
  return canonicalizeOrdersDetailEmailReviewHeader(value);
}

/**
 * Orders Gmail connected-body `orders.gmail.connected.fallbackSender`
 * sender_email display helpers (MISE-005VL).
 *
 * Pins the Orders hub Gmail connected-body sender interpolation that
 * previously selected display text with nullish coalescing before the
 * intentional localized fallback:
 * `visibleEmailConnection?.sender_email ?? t("orders.gmail.connected.fallbackSender")`.
 *
 * A Unicode-only-space sender_email (`"\u2003"`) is non-nullish
 * (`("\u2003" ?? FALLBACK) === "\u2003"`), so the intentional
 * `orders.gmail.connected.fallbackSender` copy was bypassed and the UI could
 * interpolate a blank-looking sender mailbox into
 * `orders.gmail.connected.body`. Empty string has the same `??` bypass
 * (`("" ?? FALLBACK) === ""`). Separately, Unicode `.trim()` on padded
 * sender mailboxes
 * (`"\u2003orders@harbor.kitchen\u2003".trim() === "orders@harbor.kitchen"`)
 * would invent a clean display mailbox if that gate Unicode-trimmed before
 * interpolation.
 *
 * Mailbox tips preserve NBSP: ASCII end trim only — do not fold NBSP into a
 * plain space. Soft-null when Unicode trim would still strip end padding
 * (NBSP / em-space) so padding cannot invent equality with an unpadded
 * mailbox. Accents and case are preserved. Single-line mailbox identity uses
 * full C0/DEL control rejection (no LF/TAB/CR allowlist); multiline
 * free-text note/body display stays on open #1013 / #1014 / #840.
 *
 * These are presentation **orders.gmail.connected.fallbackSender**
 * sender_email tokens only — the Orders hub Gmail connected-body sender
 * interpolation that shares that fallback. Not Settings/Gmail
 * `sender_email ?? notConnected` (#1019 /
 * presentationGmailSenderEmailIdentity), not Orders detail email-review
 * From/To/Subject (#1015), not Settings account email labels (#966), not
 * outreach-webhook From mailbox (#959), not durable demo supplier-send
 * From/To (#708), not waste itemName (#1018), not Inventory detail
 * item_name (#1017), not Orders detail supplier_name (#1016), not
 * miseDomain hard-coded English `"Gmail ready"` / `"Gmail sender not
 * linked"` setup readiness detail, and not DB COLLATE C sender_email
 * shape pins (#423 / #653). Soft empty / Unicode-padded / control-bearing
 * tokens soft-null so the live
 * `|| t("orders.gmail.connected.fallbackSender")` branch owns the
 * intentional localized fallback. Ordinary ASCII whitespace still trims
 * clean.
 *
 * Complements open #1019 / #1018 / #1017 / #1016 / #1015 / #1014 / #1013 /
 * #966 / #959 / #708 / #423 / #653 on other presentation / shape tips
 * without sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Gmail sender_email before it is rendered
 * into the Orders Gmail connected-body sender interpolation.
 */
export function asciiTrimOrdersGmailSenderEmail(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Orders Gmail connected-body sender_email under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeOrdersGmailSenderEmail(value: string): string | null {
  const trimmed = asciiTrimOrdersGmailSenderEmail(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize one Orders Gmail connected-body sender_email candidate.
 * Preserves soft empty → null (intentional localized
 * orders.gmail.connected.fallbackSender copy) while refusing to invent a
 * clean mailbox via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("orders.gmail.connected.fallbackSender")` branch owns the fallback
 * without inventing a clean sender mailbox from padding, and without
 * letting non-nullish Unicode-only space or empty string bypass that
 * fallback through the prior `??` row.
 */
export function normalizeOrdersGmailSenderEmail(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously bypassed the intentional localized fallbackSender copy via
  // `??`. Do not invent a clean Gmail sender mailbox from padding.
  if (!value.trim()) return null;
  return canonicalizeOrdersGmailSenderEmail(value);
}

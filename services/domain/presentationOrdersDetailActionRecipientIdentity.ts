/**
 * Orders detail approveAndSend a11y recipient identity helpers (MISE-005XI).
 *
 * Pins the Orders detail approve-and-send accessibility interpolation that
 * previously always passed raw `visibleEmailPayload?.to` (or empty string)
 * into the recipient token:
 * `t("orders.detail.action.approveAndSendAccessibility", {
 *   supplier: visibleOrder.supplier_name,
 *   recipient: visibleEmailPayload?.to ?? ""
 * })`
 *
 * A Unicode-only-space mailbox (`"\u2003"`) is non-nullish, so
 * `visibleEmailPayload?.to ?? ""` still interpolated that blank-looking
 * recipient into the VoiceOver / TalkBack label with no intentional localized
 * none marker. Empty / missing `to` collapsed to `""` and produced the same
 * blank-looking recipient. Separately, Unicode `.trim()` on a padded mailbox
 * (`"\u2003produce@local.example\u2003".trim() === "produce@local.example"`)
 * would invent a clean recipient identity if that gate Unicode-trimmed before
 * interpolating into the approveAndSend a11y chrome.
 *
 * Single-line mailbox tips use ASCII end trim only and preserve NBSP (no fold
 * into plain space). Soft-null when Unicode trim would still strip end padding
 * (NBSP / em-space) so padding cannot invent equality with an unpadded
 * mailbox. Accents and case are preserved. Full C0/DEL control rejection
 * applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **orders.detail.action.recipient.none** recipient
 * tokens only — the approveAndSend a11y `recipient` interpolation that falls
 * through to that fallback when soft-null. Not email-review From / To /
 * Subject display (#1015 / MISE-005VG), not email-review body (#1014), not
 * note.none (#1013), not operator_note (#840), not durable send From/To
 * (#708), not durable send subject (#913), not Settings suppliers
 * recipient-email (#1032), not supplier-recipient email client normalize
 * (#681), not Orders detail action a11y supplier_name (#1068), not Orders
 * detail Screen title supplier_name (#1016), and not receive-discrepancy
 * (#670). Soft empty / Unicode-padded / control-bearing tokens soft-null so
 * the live `|| t("orders.detail.action.recipient.none")` branch owns the
 * intentional localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1015 / #1014 / #1013 / #840 / #708 / #913 / #1032 / #681 /
 * #1068 / #1016 / #670 without sharing those modules or rewriting their call
 * sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Orders detail approveAndSend a11y recipient
 * mailbox before it is interpolated into the accessibility label.
 */
export function asciiTrimOrdersDetailActionRecipient(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Orders detail approveAndSend a11y recipient mailbox under
 * ASCII C. Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeOrdersDetailActionRecipient(
  value: string
): string | null {
  const trimmed = asciiTrimOrdersDetailActionRecipient(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Orders detail approveAndSend a11y
 * `visibleEmailPayload?.to`. Preserves soft empty → null (intentional
 * localized action.recipient.none copy) while refusing to invent a clean
 * mailbox via Unicode em-space / NBSP trim. Does not throw; Unicode-padded /
 * unsafe / non-string tokens return null so the live
 * `|| t("orders.detail.action.recipient.none")` branch owns the fallback
 * without inventing a clean approveAndSend a11y recipient from padding, and
 * without letting non-nullish Unicode-only space or empty-string `?? ""`
 * interpolate a blank-looking recipient through the prior always-pass path.
 */
export function normalizeOrdersDetailActionRecipient(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still interpolated into approveAndSend a11y instead of the
  // intentional localized action.recipient.none copy.
  // Do not invent a clean Orders detail approveAndSend a11y recipient from padding.
  if (!value.trim()) return null;
  return canonicalizeOrdersDetailActionRecipient(value);
}

/**
 * Settings suppliers read-only recipient-email presentation helpers
 * (MISE-005VX).
 *
 * Pins the Settings suppliers directory surfaces that previously treated
 * stored `entry.email` as truthy / non-nullish before intentional
 * not-configured presentation:
 *
 * - configured count: `Boolean(entry.email)`
 * - ready/needs-email badge + icon tone: `entry.email ? …`
 * - read-only display: `entry.email ?? copy.notConfigured`
 * - read-only a11y: `email ?? "not configured"` (and locale peers)
 *
 * A Unicode-only-space recipient email (`"\u2003"`) is truthy and
 * non-nullish (`Boolean("\u2003") === true`,
 * `("\u2003" ?? FALLBACK) === "\u2003"`), so a connected-but-padded row
 * could count as Ready, render blank-looking mailbox text, and bypass
 * the intentional `copy.notConfigured` / a11y missing copy. Empty string
 * has the same `??` bypass (`("" ?? FALLBACK) === ""`). Separately,
 * Unicode `.trim()` on padded mailboxes
 * (`"\u2003orders@farm.co\u2003".trim() === "orders@farm.co"`) would invent
 * a clean display mailbox if that gate Unicode-trimmed before rendering.
 *
 * Mailbox tips preserve NBSP: ASCII end trim only — do not fold NBSP into
 * a plain space. Soft-null when Unicode trim would still strip end padding
 * (NBSP / em-space) so padding cannot invent equality with an unpadded
 * mailbox. Accents and case are preserved. Single-line mailbox identity
 * uses full C0/DEL control rejection (no LF/TAB/CR allowlist).
 *
 * These are presentation **Settings suppliers stored recipient-email**
 * tokens only — configured-count / badge / read-only display + a11y that
 * fall through to `copy.notConfigured`. Not suppliers draft-email save /
 * equality identity (#690 / MISE-005JU `supplierSettingsEmailIdentity`),
 * not suppliers display-name identity (#691 / MISE-005JV), not
 * Settings/Gmail connection `sender_email` (#1019 / MISE-005VK), not
 * Orders gmail connected-body sender (#1020 / MISE-005VL), not
 * setup-readiness Email `sender_email` (#1031 / MISE-005VW), not
 * Settings account email labels (#966 / MISE-005UB), not Orders detail
 * email-review headers (#1015), and not durable recipient write-path
 * shape pins (#681 / #423). Soft empty / Unicode-padded / control-bearing
 * tokens soft-null so the live `|| copy.notConfigured` / needsEmail
 * branches own the intentional missing-email presentation. Ordinary ASCII
 * whitespace still trims clean.
 *
 * Complements open #690 / #691 / #1031 / #1020 / #1019 / #1015 / #966 /
 * #681 / #423 without sharing those modules or rewriting their draft /
 * save / rename call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized suppliers recipient email before it is
 * rendered into Settings suppliers configured / read-only presentation.
 */
export function asciiTrimSuppliersSettingsRecipientEmail(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Settings suppliers stored recipient email under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeSuppliersSettingsRecipientEmail(
  value: string
): string | null {
  const trimmed = asciiTrimSuppliersSettingsRecipientEmail(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize one Settings suppliers stored recipient-email candidate.
 * Preserves soft empty → null (intentional `copy.notConfigured` /
 * needsEmail presentation) while refusing to invent a clean mailbox via
 * Unicode em-space / NBSP trim. Does not throw; Unicode-padded / unsafe /
 * non-string tokens return null so the live configured / read-only
 * branches own missing-email presentation without inventing a clean
 * mailbox from padding, and without letting truthy Unicode-only space or
 * non-nullish empty string bypass those fallbacks through the prior
 * `Boolean` / `??` rows.
 */
export function normalizeSuppliersSettingsRecipientEmail(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): truthy / non-nullish
  // padding previously counted as configured and bypassed notConfigured via `??`.
  // Do not invent a clean suppliers recipient mailbox from padding.
  if (!value.trim()) return null;
  return canonicalizeSuppliersSettingsRecipientEmail(value);
}

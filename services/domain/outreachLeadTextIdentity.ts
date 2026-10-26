/**
 * Outreach lead text identity helpers (MISE-005QM).
 *
 * Pins domain-layer `normalizeOutreachLead` / `requireText` prep outside the
 * repository graph so Node tests can exercise inventing proofs without loading
 * Supabase or AsyncStorage. The prior path Unicode-trimmed lead text fields
 * (businessName, contactName, city, state, cuisine, fitNotes, sourceUrl,
 * website, and the email string before mailbox normalize) and then stored the
 * trimmed result (`'\u2003Harbor Grill\u2003'.trim() === 'Harbor Grill'`).
 *
 * These are operator-supplied lead identity / contact fields, not free-form
 * greeting presentation and not the separate mailbox fold (#420). Only ASCII
 * end trim is pinned; case and accents are left unchanged so presentation
 * stays operator-faithful. Soft empty (ASCII whitespace or Unicode-only
 * space) keeps the prior length-bound error. Unicode-padded non-empty tokens
 * fail closed rather than inventing equality with the unpadded label.
 *
 * Control-character contract stays the prior allowlist (TAB / LF / CR kept;
 * other ASCII controls rejected) so multiline fit notes and single-line
 * names share one require path without expanding this tip into a full
 * `[[:cntrl:]]` migration.
 *
 * Complements open outreach_leads.*.cntrl SQL tips (#631 / #643–#646 / #642),
 * outreach-agent Edge string tip #724 / MISE-005KU, and mailbox tip #420
 * without sharing those modules or rewriting mailbox normalize, greeting
 * first-name rendering, or AI draft bounded-text prep.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized outreach lead text token before it is
 * stored on the accepted lead row.
 */
export function asciiTrimOutreachLeadText(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

/** Prior requireText control allowlist: reject controls except TAB / LF / CR. */
function hasUnsupportedControlCharacters(value: string) {
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value);
}

/**
 * Canonicalize an outreach lead text token under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing unsupported ASCII controls.
 */
export function canonicalizeOutreachLeadText(value: string): string | null {
  const trimmed = asciiTrimOutreachLeadText(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasUnsupportedControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed text normalize for outreach `requireText` / inventing proofs.
 * Preserves prior error contracts:
 * - non-string → `${fieldName} is required.`
 * - soft empty / over-long → `${fieldName} must contain 1-${maximumLength} characters.`
 * - unsupported controls → `${fieldName} contains unsupported control characters.`
 * - Unicode-padded (would invent via `.trim()`) → `${fieldName} is required.`
 */
export function normalizeCanonicalOutreachLeadText(
  value: unknown,
  fieldName: string,
  maximumLength: number
): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} is required.`);
  }
  // Soft empty for ASCII whitespace or Unicode-only space: prior `.trim()`
  // emptied those into the length bound check. Preserve that contract.
  if (!value.trim()) {
    throw new Error(
      `${fieldName} must contain 1-${maximumLength} characters.`
    );
  }
  if (hasUnsupportedControlCharacters(value)) {
    throw new Error(`${fieldName} contains unsupported control characters.`);
  }
  const canonical = canonicalizeOutreachLeadText(value);
  if (!canonical) {
    throw new Error(`${fieldName} is required.`);
  }
  if (canonical.length < 1 || canonical.length > maximumLength) {
    throw new Error(
      `${fieldName} must contain 1-${maximumLength} characters.`
    );
  }
  return canonical;
}

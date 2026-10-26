/**
 * Outreach AI draft bounded-text helpers (MISE-005QN).
 *
 * Pins `services/ai/outreachDraft.ts` `requireBoundedText` prep (subject, body,
 * personalization_note) outside the repository graph so Node tests can
 * exercise inventing proofs without loading Supabase or AsyncStorage. The
 * prior path Unicode-trimmed draft fields and stored the trimmed result
 * (`'\u2003A simpler prep rhythm\u2003'.trim() === 'A simpler prep rhythm'`)
 * before structured drafts were accepted for send / fallback rendering.
 *
 * Draft body and personalization notes are multiline / free-text (parity with
 * open MISE-005PF supplier operator_note / MISE-005PT inventory-operation note
 * / MISE-005QF Daily Ops askBriefingText). Subject is still a single safe
 * header line after this prep — the existing `/[\r\n\u0000-\u001F\u007F]/`
 * gate in `parseOutreachDraft` keeps that contract. Fold NBSP to a plain
 * space, then trim only C-locale `[[:space:]]` from the ends. Do not collapse
 * internal whitespace with `\s` or Unicode `String#trim`, so internal LF/TAB/CR
 * survive in body text and em-space padding cannot invent equality with an
 * unpadded draft token. Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks body drafts need. Subject's post-parse header gate remains the
 * stricter single-line check.
 *
 * Complements open outreach lead requireText tip (#873 / MISE-005QM), mailbox
 * tip (#420), and outreach-agent Edge string tip (#724) without sharing those
 * modules or rewriting lead `requireText`, mailbox fold, greeting first-name
 * rendering, or Edge string prep.
 *
 * Max lengths stay the prior `OUTREACH_*_MAX_CHARACTERS` bounds. Soft empty /
 * Unicode-only space keeps the prior length-bound error. Live require
 * preserves the prior messages (`${fieldName} must be text.` /
 * `${fieldName} must contain 1-${maximumLength} characters.`).
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for outreach draft subject / body / personalization
 * tokens. Folds NBSP, C-whitespace-trims ends only. Does not Unicode-trim or
 * collapse with `\s`, so em-space padding cannot invent equality with an
 * unpadded draft token and internal newlines stay intact.
 */
export function canonicalOutreachDraftText(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Fail-closed outreach draft bounded-text normalize for
 * `parseOutreachDraft` / `requireBoundedText` and inventing proofs.
 *
 * Error contracts (prior `requireBoundedText`):
 * - non-string / unsafe control → `${fieldName} must be text.`
 * - soft empty / Unicode-only space / over-long →
 *   `${fieldName} must contain 1-${maximumLength} characters.`
 */
export function normalizeCanonicalOutreachDraftText(
  value: unknown,
  fieldName: string,
  maximumLength: number
): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be text.`);
  }
  if (hasUnsafeMultilineControls(value)) {
    throw new Error(`${fieldName} must be text.`);
  }
  // Soft empty for ASCII whitespace or Unicode-only space: prior `.trim()`
  // emptied those into the length bound check. Preserve that contract.
  if (!value.trim()) {
    throw new Error(
      `${fieldName} must contain 1-${maximumLength} characters.`
    );
  }
  const prepared = canonicalOutreachDraftText(value);
  if (!prepared) {
    throw new Error(
      `${fieldName} must contain 1-${maximumLength} characters.`
    );
  }
  if (prepared.length > maximumLength) {
    throw new Error(
      `${fieldName} must contain 1-${maximumLength} characters.`
    );
  }
  return prepared;
}

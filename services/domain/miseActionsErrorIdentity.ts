/**
 * Mise-actions domain error free-text helpers (MISE-005OT).
 *
 * Pins domain-layer `markFailed` `error` outside the repository graph so Node
 * tests can exercise inventing proofs without loading Supabase or demo storage.
 * Failure messages previously Unicode-trimmed (`.trim()` only), so
 * NBSP/em-space padding invented a clean free-text body before the durable
 * action error field stored it
 * (`'\u2003Provider unavailable\u2003'.trim() === 'Provider unavailable'`).
 *
 * Action errors are multiline operator free-text (parity with supplier
 * `operator_note` / open SQL cntrl pin #554 / MISE-005OO detail /
 * MISE-005OP completionResult / MISE-005OS count-line note / MISE-005EP): fold
 * NBSP to a plain space, then trim only C-locale `[[:space:]]` from the ends.
 * Do not collapse internal whitespace with `\s` or Unicode `String#trim`, so
 * internal LF/TAB/CR survive and em-space padding cannot invent equality with
 * an unpadded error. Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks operators need in failure diagnostics.
 *
 * Complements open mise-actions approvedBy tip #800 / MISE-005NR,
 * rollbackReference tip #801 / MISE-005NS, and subject/idempotency/action tip
 * #772 / MISE-005MP without sharing their helper modules or rewriting those
 * paths. Intentionally does not change `lesson` free-text on
 * `measureOutcome`, `requestedBy` pass-through, hydrate `error_message`
 * pass-through, or restaurantMemory lesson consumers. Those remain on their
 * existing Unicode-trim / pass-through contracts in this tip.
 *
 * Max length stays 1000 to match the hosted `mise_actions.error_message` /
 * `record_action_failure` bound (`left(trim(...), 1000)`). Empty-after-prep
 * (including Unicode-only spaces) preserves the prior soft default
 * `"Action failed."` so a blank failure still records an explicit status
 * message. Distinct from open SQL cntrl pin #554.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for mise-actions error on markFailed. Folds NBSP,
 * C-whitespace-trims ends only. Does not Unicode-trim or collapse with `\s`,
 * so em-space padding cannot invent equality with an unpadded error and
 * internal newlines stay intact.
 */
export function canonicalMiseActionsError(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Fail-closed error normalize for markFailed. Preserves the prior soft default
 * `"Action failed."` for empty / Unicode-only space while refusing
 * unsafe-control / over-long / non-string tokens, and refusing to invent a
 * clean error via Unicode em-space trim.
 *
 * Error contracts:
 * - non-string / unsafe control → `Mise action error must be text.`
 * - over-long (>1000) → `Mise action error is outside supported limits.`
 */
export function normalizeCanonicalMiseActionsError(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Mise action error must be text.");
  }
  if (hasUnsafeMultilineControls(value)) {
    throw new Error("Mise action error must be text.");
  }
  const canonical = canonicalMiseActionsError(value);
  // Preserve soft default for empty / Unicode-only space (em-space alone):
  // prior `.trim() || "Action failed."` treated that as the default message.
  // Do not invent a one-character error from em-space alone.
  if (!canonical || !value.trim()) {
    return "Action failed.";
  }
  if (canonical.length > 1000) {
    throw new Error("Mise action error is outside supported limits.");
  }
  return canonical;
}

/**
 * Setup POS CSV sale-date identity helpers (MISE-005QK).
 *
 * Pins domain-layer guided POS import sale-date prep outside the repository
 * graph so Node tests can exercise inventing proofs without loading Supabase
 * or AsyncStorage. The prior path Unicode-trimmed CSV `saleDate` cells and
 * `normalizeSaleDate` before accepting ISO / slash calendar tokens as the
 * durable imported sale date and fingerprint component
 * (`'\u20032026-08-01\u2003'.trim() === '2026-08-01'`,
 * `'\u00a06/30/2026\u00a0'.trim() === '6/30/2026'`).
 *
 * These are single-line calendar-date sale identities, not free-form
 * multiline prose. Only ASCII end trim is pinned. After ASCII prep, the value
 * must still be a real UTC calendar day in `YYYY-MM-DD` or `M/D/YYYY` form;
 * Unicode-padded tokens soft to `""` so the live row validation
 * (`if (!saleDate) … "Use YYYY-MM-DD"`) stays intact rather than inventing
 * equality with an unpadded date.
 *
 * Complements open setupDrafts header/fingerprint tip #676 / MISE-005JG,
 * setup recipe dish-name tip #862 / MISE-005QB, setup inventory-unit tip
 * #861 / MISE-005QA, Insights sales soft throughDate tip #870 / MISE-005QJ,
 * and purchase-line throw-closed ISO date tip #858 / MISE-005PX without
 * sharing those modules or rewriting itemName / category / quantity /
 * fingerprint Unicode prep on this path.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized setup POS sale date before it is stored
 * on the accepted import row and fingerprint.
 */
export function asciiTrimSetupPosSaleDate(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

function isExactCalendarDate(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Canonicalize a setup POS CSV sale date under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, containing
 * ASCII controls, or not a real `YYYY-MM-DD` / `M/D/YYYY` calendar day.
 */
export function canonicalizeSetupPosSaleDate(value: string): string | null {
  const trimmed = asciiTrimSetupPosSaleDate(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;

  if (/^\d{4}-\d{2}-\d{2}$/u.test(trimmed) && isExactCalendarDate(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/u);
  if (!match) return null;
  const [, month, day, year] = match;
  const normalized = `${year}-${month!.padStart(2, "0")}-${day!.padStart(2, "0")}`;
  return isExactCalendarDate(normalized) ? normalized : null;
}

/**
 * Soft normalize for guided POS CSV `saleDate` identity.
 * Preserves soft empty → row-level "Use YYYY-MM-DD" review while refusing
 * to invent a clean calendar date via Unicode em-space / NBSP trim.
 * Non-string, control-bearing, Unicode-padded, and non-calendar tokens soft
 * to `""`.
 */
export function normalizeSetupPosSaleDate(value: unknown): string {
  if (typeof value !== "string") return "";
  if (value === "") return "";
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those and failed the sale_date row check.
  if (!value.trim()) return "";
  return canonicalizeSetupPosSaleDate(value) ?? "";
}

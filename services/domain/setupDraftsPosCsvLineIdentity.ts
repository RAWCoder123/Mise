/**
 * Setup-drafts POS CSV line helpers (MISE-005RV).
 *
 * Pins `services/domain/setupDrafts.ts` `parseSetupPosSalesCsv` per-line prep
 * outside the React Native screen graph so Node tests can exercise inventing
 * proofs without loading Expo. The prior path fed each newline-split POS CSV
 * line through `line.trim()` before header detection, `splitCsvLine`, and
 * durable accepted POS sales rows / fingerprints
 * (`'\u2003' + '2026-08-01,Chicken Bowl,Mains,2,20' + '\u2003').trim() ===
 * '2026-08-01,Chicken Bowl,Mains,2,20'`), so NBSP / em-space padding invented
 * a clean CSV line the operator did not type as ordinary ASCII text.
 * Unicode-only space also invented an empty line via `'\u2003'.trim() === ''`
 * that the empty filter dropped.
 *
 * These are setup-drafts **POS CSV lines** only — not setup POS itemName /
 * category cell prep (open #872 / MISE-005QL), not setup POS saleDate cell
 * prep (open #871 / MISE-005QK), not cell-level `raw.trim()` for quantity /
 * grossSales, not setup-drafts recipe dishName / ingredient tokens (open
 * #900 / #898 / #899 / #897), not demo recipe-baseline line trim (open #907 /
 * MISE-005RU), and not free-form notes. Soft empty (ASCII whitespace or
 * Unicode-only space) stays `empty` so callers keep the prior empty-after-trim
 * skip contract. Ordinary ASCII whitespace still trims clean before CSV parse.
 * Unicode-padded or control-bearing drafts fail closed as `invalid` so padded
 * full lines cannot invent a clean accepted sales row.
 *
 * Complements open setup POS item/category tip #872 / MISE-005QL and saleDate
 * tip #871 / MISE-005QK without sharing those modules. Leave
 * `(record.itemName ?? "").trim()`, `(record.category ?? "").trim()`,
 * `normalizeSaleDate(record.saleDate ?? "")`, and other CSV cell trim paths
 * alone until their own tips own those surfaces.
 */

export type SetupDraftsPosCsvLinePrep =
  | { status: "empty" }
  | { status: "ok"; text: string }
  | { status: "invalid" };

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized setup-drafts POS CSV line before header
 * detection and durable accepted sales rows.
 */
export function asciiTrimSetupDraftsPosCsvLineText(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a setup-drafts POS CSV line under ASCII C.
 * Returns `empty` when blank after ASCII trim, `invalid` when still
 * Unicode-padded / control-bearing, otherwise `ok` with the ASCII-trimmed
 * text for header detection / `splitCsvLine` / durable row accept.
 */
export function canonicalizeSetupDraftsPosCsvLineText(
  value: string
): SetupDraftsPosCsvLinePrep {
  const trimmed = asciiTrimSetupDraftsPosCsvLineText(value);
  if (!trimmed) return { status: "empty" };
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return { status: "invalid" };
  if (hasControlCharacters(trimmed)) return { status: "invalid" };
  return { status: "ok", text: trimmed };
}

/**
 * Soft normalize for setup-drafts POS CSV line parse.
 * Preserves soft empty → `empty` (prior `line.trim()` empty path) while
 * refusing to invent a clean draft via Unicode em-space / NBSP trim.
 * Non-string and control-bearing / padded tokens are `invalid`.
 */
export function prepareSetupDraftsPosCsvLineText(
  value: unknown
): SetupDraftsPosCsvLinePrep {
  if (typeof value !== "string") return { status: "invalid" };
  if (value === "") return { status: "empty" };
  // Soft empty for Unicode-only space (em-space alone): prior
  // `line.trim()` emptied those into the empty-line skip.
  if (!value.trim()) return { status: "empty" };
  return canonicalizeSetupDraftsPosCsvLineText(value);
}

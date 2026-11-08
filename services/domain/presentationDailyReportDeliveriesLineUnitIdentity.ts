/**
 * Daily Report deliveries.line unit identity helpers (MISE-005AAJ).
 *
 * Pins the Daily Report free-form `line.unit` interpolation that previously
 * always passed raw `line.unit` into the deliveries qty copy whenever the
 * unit was truthy:
 * `${formatNumber(line.quantity)}${line.unit ? ` ${line.unit}` : ""}`.
 *
 * A Unicode-only-space unit (`"\u2003"`) is non-nullish and truthy as a
 * delivery-line field, so Daily Report still rendered blank-looking unit
 * identity in qty copy (`"12  "`). Empty string already omitted via the
 * falsy branch. Separately, Unicode `.trim()` on a padded unit
 * (`"\u2003cs\u2003".trim() === "cs"`) would invent a clean display unit
 * identity if that gate Unicode-trimmed before interpolating into Daily
 * Report deliveries.line unit copy.
 *
 * Single-line unit tips use ASCII end trim only and preserve NBSP (no fold
 * into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded unit. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **Daily Report deliveries.line.unit** tokens only —
 * the qty-suffix `line.unit` that soft-nulls back to the prior omit-unit
 * falsy branch (`""` after quantity) when unsafe. Not Daily Report
 * deliveries.line itemName (#1065 / MISE-005XE), not Daily Report waste /
 * sales itemName tips (#1064 / #1063), not Inventory hub unit (#1192 /
 * MISE-005AAG), not Inventory detail unit (#1191 / MISE-005AAF), not Scan
 * Item quantity unit (#1193 / MISE-005AAH), not RecommendationDecisionRow
 * suggested unit (#1194 / MISE-005AAI), not setup inventory units (#861 /
 * MISE-005QA), not inventory recipe-mapping units (#864 / MISE-005QD), not
 * inventory unit client helpers (#669 / MISE-005JA), not
 * purchase_recommendations.unit cntrl CHECK (#590 / MISE-005FZ), not
 * inventory_items.unit cntrl CHECK (#586 / MISE-005FV), not deliveryHistory
 * notes (#837 / MISE-005PC), and not controlled inventory.ops.unit
 * canonical labels. Soft empty / Unicode-padded / control-bearing tokens
 * soft-null so the live omit-unit branch owns the intentional quantity-
 * only fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1065 / #1192 / #1191 / #1193 / #1194 / #861 / #864 /
 * #669 / #590 / #586 / #837 without sharing those modules or rewriting
 * their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Daily Report deliveries.line unit before
 * it is rendered into qty copy.
 */
export function asciiTrimDailyReportDeliveriesLineUnit(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Daily Report deliveries.line unit under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeDailyReportDeliveriesLineUnit(
  value: string
): string | null {
  const trimmed = asciiTrimDailyReportDeliveriesLineUnit(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Daily Report deliveries `line.unit` display.
 * Preserves soft empty → null (intentional omit-unit qty fallthrough) while
 * refusing to invent a clean unit via Unicode em-space / NBSP trim. Does not
 * throw; Unicode-padded / unsafe / non-string tokens return null so the live
 * omit-unit branch owns the fallback without inventing a clean Daily Report
 * deliveries.line unit from padding, and without letting non-nullish
 * Unicode-only space render a blank-looking unit through the prior
 * always-pass truthy qty suffix path.
 */
export function normalizeDailyReportDeliveriesLineUnit(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into Daily Report deliveries qty copy as a
  // blank-looking unit identity.
  // Do not invent a clean Daily Report deliveries.line unit from padding.
  if (!value.trim()) return null;
  return canonicalizeDailyReportDeliveriesLineUnit(value);
}

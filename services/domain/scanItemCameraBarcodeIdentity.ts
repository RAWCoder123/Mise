/**
 * Scan Item camera barcode helpers (MISE-005RY).
 *
 * Pins `app/more/scan-item.tsx` `handleBarcode` camera payload prep outside the
 * React Native screen graph so Node tests can exercise inventing proofs without
 * loading Expo. The prior path Unicode-trimmed `result.data` before match,
 * display, and query seeding (`'\u2003012345678905\u2003'.trim() ===
 * '012345678905'`), so NBSP / em-space padding invented a clean scanned code
 * that drove `matchInventoryBarcode`, `lastScannedCode`, and `setQuery`.
 * Unicode-only space also invented the empty / ignore-scan branch via
 * `'\u2003'.trim() === ''`.
 *
 * These are single-line camera barcode payloads only — not typed Scan Item
 * text-search needles (open #697 / MISE-005KB), not barcode / inventory match
 * token normalize (open #687 / MISE-005JR), and not Log Delivery or inventory
 * quantity drafts. Soft empty (ASCII whitespace or Unicode-only space) stays
 * `empty` so callers keep the prior ignore-scan contract. Ordinary ASCII
 * whitespace still trims clean before match / display / query seeding.
 * Unicode-padded or control-bearing payloads fail closed as `invalid` so
 * padded `"012345678905"` cannot invent a navigation or query seed.
 *
 * Complements open Scan Item text-search tip #697 / MISE-005KB and inventory
 * barcode match tip #687 / MISE-005JR without sharing those modules. Leave
 * typed-search matching and barcode-match token normalize alone until those
 * tips own those surfaces on main.
 */

export type ScanItemCameraBarcodePrep =
  | { status: "empty" }
  | { status: "ok"; text: string }
  | { status: "invalid" };

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized camera barcode before match, display, and
 * query seeding.
 */
export function asciiTrimScanItemCameraBarcodeText(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Scan Item camera barcode payload under ASCII C.
 * Returns `empty` when blank after ASCII trim, `invalid` when still
 * Unicode-padded / control-bearing, otherwise `ok` with the ASCII-trimmed
 * text for match / display / query seeding.
 */
export function canonicalizeScanItemCameraBarcodeText(
  value: string
): ScanItemCameraBarcodePrep {
  const trimmed = asciiTrimScanItemCameraBarcodeText(value);
  if (!trimmed) return { status: "empty" };
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return { status: "invalid" };
  if (hasControlCharacters(trimmed)) return { status: "invalid" };
  return { status: "ok", text: trimmed };
}

/**
 * Soft normalize for Scan Item camera barcode scans.
 * Preserves soft empty → `empty` (prior `result.data?.trim()` emptiness →
 * ignore scan) while refusing to invent a clean code via Unicode em-space /
 * NBSP trim. Non-string and control-bearing / padded tokens are `invalid`.
 */
export function prepareScanItemCameraBarcodeText(
  value: unknown
): ScanItemCameraBarcodePrep {
  if (typeof value !== "string") return { status: "invalid" };
  if (value === "") return { status: "empty" };
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()` emptied
  // those into the ignore-scan branch.
  if (!value.trim()) return { status: "empty" };
  return canonicalizeScanItemCameraBarcodeText(value);
}

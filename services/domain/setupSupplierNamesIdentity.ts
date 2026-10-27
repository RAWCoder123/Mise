/**
 * Setup supplierNames list helpers (MISE-005RR).
 *
 * Pins `app/(auth)/setup.tsx` supplier `name` prep outside the React Native
 * screen graph so Node tests can exercise inventing proofs without loading
 * Expo. The prior path fed those drafts into `supplier.name.trim()` for the
 * durable `supplierNames` list passed to `continueWithDemo` (demo supplier
 * catalog + `operational_profile.primarySuppliers`) and hosted
 * `updateRestaurantProfile` `primarySuppliers`, which Unicode-trim before
 * durable use (`'\u2003Fresh\u2003'.trim() === 'Fresh'`), so NBSP / em-space
 * padding invented a clean supplier name the operator did not type as
 * ordinary ASCII text. Unicode-only space also invented the skip-empty
 * branch via `'\u2003'.trim() === ''`.
 *
 * These are setup-screen **supplierNames list** drafts only — not application
 * setup supplier-name keys / email (open #680 / MISE-005JK), not auth
 * setup-screen supplier duplicate / email identity (open #696 / MISE-005KA),
 * not operational-profile array-entry normalize after profile update (open
 * #852 / MISE-005PR), not setup inventory item names (open #903 /
 * MISE-005RQ), and not free-form notes. Soft empty (ASCII whitespace or
 * Unicode-only space) stays `empty` so callers keep the prior filter(Boolean)
 * skip contract. Ordinary ASCII whitespace still trims clean before durable
 * supplierNames. Unicode-padded or control-bearing drafts fail closed as
 * `invalid` so padded `"Fresh"` cannot invent a supplier name.
 *
 * Complements open application supplier tip #680 / MISE-005JK and
 * setup-screen supplier identity tip #696 / MISE-005KA without sharing those
 * modules. Leave validate duplicate/email bare `supplier.name.trim()` to
 * #696, application `supplier.name.trim()` to #680, chip labels /
 * supplier_count bare trim, inventory supplier emptiness `supplier.name.trim()`,
 * and inventory item name tip #903 alone.
 */

export type SetupSupplierNamePrep =
  | { status: "empty" }
  | { status: "ok"; text: string }
  | { status: "invalid" };

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized setup supplier name before durable
 * supplierNames → demo / primarySuppliers.
 */
export function asciiTrimSetupSupplierNameText(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a setup supplier name draft under ASCII C.
 * Returns `empty` when blank after ASCII trim, `invalid` when still
 * Unicode-padded / control-bearing, otherwise `ok` with the ASCII-trimmed
 * text for durable supplierNames.
 */
export function canonicalizeSetupSupplierNameText(
  value: string
): SetupSupplierNamePrep {
  const trimmed = asciiTrimSetupSupplierNameText(value);
  if (!trimmed) return { status: "empty" };
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return { status: "invalid" };
  if (hasControlCharacters(trimmed)) return { status: "invalid" };
  return { status: "ok", text: trimmed };
}

/**
 * Soft normalize for setup supplierNames validate / durable list.
 * Preserves soft empty → `empty` (prior `supplier.name.trim()` filter skip)
 * while refusing to invent a clean draft via Unicode em-space / NBSP trim.
 * Non-string and control-bearing / padded tokens are `invalid`.
 */
export function prepareSetupSupplierNameText(
  value: unknown
): SetupSupplierNamePrep {
  if (typeof value !== "string") return { status: "invalid" };
  if (value === "") return { status: "empty" };
  // Soft empty for Unicode-only space (em-space alone): prior
  // `supplier.name.trim()` emptied those into the filter(Boolean) skip branch.
  if (!value.trim()) return { status: "empty" };
  return canonicalizeSetupSupplierNameText(value);
}

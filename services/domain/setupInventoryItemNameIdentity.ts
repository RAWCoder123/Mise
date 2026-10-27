/**
 * Setup inventory item name draft helpers (MISE-005RQ).
 *
 * Pins `app/(auth)/setup.tsx` inventory `name` prep outside the React Native
 * screen graph so Node tests can exercise inventing proofs without loading
 * Expo. The prior path fed those drafts into `item.name.trim()` emptiness /
 * label gates and into `inventoryItemNames` → `continueWithDemo` /
 * `normalizeInventoryDraftNumbers` → hosted `saveRestaurantSetup`, which
 * Unicode-trim before durable use (`'\u2003Tomato\u2003'.trim() === 'Tomato'`),
 * so NBSP / em-space padding invented a clean inventory item name the
 * operator did not type as ordinary ASCII text. Unicode-only space also
 * invented the required-empty branch via `'\u2003'.trim() === ''`.
 *
 * These are single-line setup inventory **item name** drafts only — not
 * application inventory-name key matching (open #679 / MISE-005JJ), not setup
 * inventory on-hand quantity (open #895 / MISE-005RI), not setup inventory
 * parLevel (open #894 / MISE-005RH), not setup inventory unit (open #861 /
 * MISE-005QA), not setup recipe ingredient itemName (open #901 / MISE-005RO),
 * not application recipe ingredient itemName save (open #902 / MISE-005RP),
 * and not free-form notes. Soft empty (ASCII whitespace or Unicode-only
 * space) stays `empty` so callers keep the prior required-name emptiness
 * contract. Ordinary ASCII whitespace still trims clean before labels /
 * normalize / demo inventoryItemNames. Unicode-padded or control-bearing
 * drafts fail closed as `invalid` so padded `"Tomato"` cannot invent an
 * inventory item name.
 *
 * Complements open application inventory-name tip #679 / MISE-005JJ and
 * setup inventory quantity / parLevel tips #895 / #894 without sharing those
 * modules. Leave hasDraftData emptiness on bare `item.name.trim()`,
 * application `draft.name.trim()`, quantity / parLevel / unit, and supplier
 * name tips alone.
 */

export type SetupInventoryItemNamePrep =
  | { status: "empty" }
  | { status: "ok"; text: string }
  | { status: "invalid" };

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized setup inventory item name before
 * validation labels, demo inventoryItemNames, and save normalize.
 */
export function asciiTrimSetupInventoryItemNameText(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a setup inventory item name draft under ASCII C.
 * Returns `empty` when blank after ASCII trim, `invalid` when still
 * Unicode-padded / control-bearing, otherwise `ok` with the ASCII-trimmed
 * text for labels / normalize / demo inventoryItemNames.
 */
export function canonicalizeSetupInventoryItemNameText(
  value: string
): SetupInventoryItemNamePrep {
  const trimmed = asciiTrimSetupInventoryItemNameText(value);
  if (!trimmed) return { status: "empty" };
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return { status: "invalid" };
  if (hasControlCharacters(trimmed)) return { status: "invalid" };
  return { status: "ok", text: trimmed };
}

/**
 * Soft normalize for setup inventory item name validate / normalize.
 * Preserves soft empty → `empty` (prior required `item.name.trim()`
 * emptiness) while refusing to invent a clean draft via Unicode em-space /
 * NBSP trim. Non-string and control-bearing / padded tokens are `invalid`.
 */
export function prepareSetupInventoryItemNameText(
  value: unknown
): SetupInventoryItemNamePrep {
  if (typeof value !== "string") return { status: "invalid" };
  if (value === "") return { status: "empty" };
  // Soft empty for Unicode-only space (em-space alone): prior
  // `item.name.trim()` emptied those into the required-empty branch.
  if (!value.trim()) return { status: "empty" };
  return canonicalizeSetupInventoryItemNameText(value);
}

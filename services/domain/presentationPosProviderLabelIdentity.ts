/**
 * POS settings `posProviderLabel` identity helpers (MISE-005VV).
 *
 * Pins the POS settings demo-mode provider chrome that previously selected
 * display text with nullish coalescing before the intentional localized
 * fallbacks:
 * `posProviderLabel ?? t("common.demo")` (OperationalHero meta) and
 * `posProviderLabel ?? t("common.none")` (providers SectionHeader action),
 * plus truthy `posProviderLabel ? connected : connectSource` hero/body copy.
 *
 * A Unicode-only-space provider label (`"\u2003"`) is non-nullish
 * (`("\u2003" ?? FALLBACK) === "\u2003"`) and truthy, so the intentional
 * `common.demo` / `common.none` / connect-source copy was bypassed and the
 * POS hub could render a blank-looking "connected" provider identity. Empty
 * string has the same `??` bypass (`("" ?? FALLBACK) === ""`). Separately,
 * Unicode `.trim()` on a padded provider label
 * (`"\u2003Square\u2003".trim() === "Square"`) would invent a clean display
 * provider identity if that gate Unicode-trimmed before interpolating into
 * `pos.hero.connected` / `pos.status.demoConnected`.
 *
 * Single-line provider-label tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded provider label. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **POS settings posProviderLabel** tokens only —
 * the demo-mode provider string (or localized Manual CSV label) rendered
 * into hero / status / meta / SectionHeader action before
 * `common.demo` / `common.none` / connect-source fallbacks. Not POS mappings
 * menu-item names (#1024 / MISE-005VP), not Settings workspace cuisine_type
 * (#1023 / MISE-005VO), not Sales Import hero restaurant-name (#1022), not
 * Settings hub restaurant-name (#1021), not Orders/Gmail sender_email
 * (#1020 / #1019), not waste itemName (#1018), not Inventory detail
 * item_name (#1017), not Orders detail supplier_name (#1016), not
 * tasks.shared.* (#1025–#1028), not Insights subtitle cuisine (#1029), not
 * raw `posProvider` tone/stats selection, and not ProviderOption list
 * selection equality. Soft empty / Unicode-padded / control-bearing tokens
 * soft-null so the live `|| t("common.demo")` / `|| t("common.none")`
 * branches and falsy connect-source path own the intentional localized
 * empty states. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1029 / #1028 / #1027 / #1026 / #1025 / #1024 / #1023 /
 * #1022 / #1021 / #1020 / #1019 / #1018 / #1017 / #1016 on other
 * presentation tips without sharing those modules or rewriting their call
 * sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized POS provider label before it is rendered
 * into the POS settings hero / meta / SectionHeader action.
 */
export function asciiTrimPosProviderLabel(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a POS settings provider label under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizePosProviderLabel(value: string): string | null {
  const trimmed = asciiTrimPosProviderLabel(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize one POS settings `posProviderLabel` candidate.
 * Preserves soft empty → null (intentional localized common.demo /
 * common.none / connect-source copy) while refusing to invent a clean
 * provider label via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("common.demo")` / `|| t("common.none")` branches and falsy
 * connect-source path own the fallback without inventing a clean provider
 * identity from padding, and without letting non-nullish Unicode-only
 * space or empty string bypass those fallbacks through the prior `??` /
 * truthy rows.
 */
export function normalizePosProviderLabel(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously bypassed the intentional localized common.demo / common.none
  // copy via `??`, and truthy padding selected connected hero/body copy.
  // Do not invent a clean POS provider label from padding.
  if (!value.trim()) return null;
  return canonicalizePosProviderLabel(value);
}

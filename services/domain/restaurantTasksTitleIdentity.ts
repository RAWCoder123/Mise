/**
 * Restaurant-tasks domain title display helpers (MISE-005ON).
 *
 * Pins domain-layer `normalizeCreateRestaurantTaskInput` /
 * `restaurantTaskFromPersistedRow` `title` outside the repository graph so
 * Node tests can exercise inventing proofs without loading Supabase or demo
 * storage. Task titles previously Unicode-trimmed and collapsed through shared
 * `requiredText` (`.trim().replace(/\s+/g, " ")`), so NBSP/em-space padding
 * invented a clean single-line title before create RPC arguments or hydrated
 * task rows stored it
 * (`'\u2003Confirm chicken count\u2003'.trim().replace(/\s+/g, " ") ===
 * 'Confirm chicken count'`). Mid-string Unicode spaces were likewise collapsed
 * into ordinary ASCII spaces, inventing equality with the unpadded title.
 *
 * Presentation titles follow the same ASCII C display-prep contract used by
 * relatedSupplierName (#821 / MISE-005OM) and supplier display-name prep
 * (#410 / #691 / #692): fold NBSP to a plain space, collapse C-locale
 * `[[:space:]]`, then ASCII space trim. Unicode `String#trim` / `\s` would
 * collapse em-space and other non-C whitespace the hosted COLLATE "C" path
 * leaves alone, inventing a title the server would not treat as equal.
 * Accents and case are preserved.
 *
 * Complements open restaurant-tasks clientTaskId tip #808 / MISE-005NZ,
 * correlationId tip #809 / MISE-005OA, dependencyIds tip #810 / MISE-005OB,
 * assigneeUserId tip #811 / MISE-005OC, relatedInventoryItemId tip #812 /
 * MISE-005OD, relatedOrderId tip #813 / MISE-005OE, relatedRecommendationId
 * tip #814 / MISE-005OF, createdBy tip #815 / MISE-005OG, completedBy tip
 * #816 / MISE-005OH, locationId tip #817 / MISE-005OI, sourceReference tip
 * #820 / MISE-005OL, relatedSupplierName tip #821 / MISE-005OM, restaurant tip
 * #739 / MISE-005LI, and application taskId tip #762 / MISE-005MF without
 * sharing their helper modules or rewriting those paths. Intentionally does
 * not change other `requiredText` / `optionalText` surfaces (`restaurantId`,
 * `clientTaskId`, `correlationId`, `dependencyIds`, `assigneeUserId`,
 * `createdBy`, `relatedInventoryItemId`, `relatedOrderId`,
 * `relatedRecommendationId`, `relatedSupplierName`, `sourceReference`,
 * `taskId` on complete, `completedBy`, `locationId`, detail, or completion
 * free-text). Those remain on their existing Unicode-trim contracts in this
 * tip.
 *
 * Titles are required single-line presentation text, not durable IDs. Max
 * length stays 160 to match the prior `requiredText(..., 160, ...)` cap and
 * the hosted `title` bound. Empty-after-prep remains hard-required
 * (`Task title is invalid.`) so a missing title cannot soft-null into a
 * create or hydrate. Distinct from open SQL cntrl pin #556.
 */

const C_WHITESPACE = /[ \t\n\v\f\r]+/g;

/**
 * Canonical display text for restaurant-tasks title create / hydrate. Folds
 * NBSP, collapses C whitespace, ASCII-space trims. Does not Unicode-trim or
 * collapse with `\s`, so em-space padding cannot invent equality with an
 * unpadded title.
 */
export function canonicalRestaurantTasksTitle(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_WHITESPACE, " ")
    .replace(/^ +/, "")
    .replace(/ +$/, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Fail-closed title require for create normalization and row hydrate.
 * Preserves the existing `Task title is required.` / `Task title is invalid.`
 * error contracts from `requiredText` while refusing to invent a clean title
 * via Unicode em-space trim / `\s` collapse. Empty-after-prep (including
 * Unicode-only spaces) stays invalid for this required field.
 */
export function requireCanonicalRestaurantTasksTitle(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Task title is required.");
  }
  if (hasControlCharacters(value)) {
    throw new Error("Task title is invalid.");
  }
  const canonical = canonicalRestaurantTasksTitle(value);
  if (!canonical || canonical.length > 160) {
    throw new Error("Task title is invalid.");
  }
  // Unicode-only spaces (for example em-space alone): prior requiredText treated
  // empty-after-Unicode-trim as invalid. Do not invent a one-character title.
  if (!value.trim()) {
    throw new Error("Task title is invalid.");
  }
  return canonical;
}

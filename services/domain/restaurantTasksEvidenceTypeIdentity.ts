/**
 * Restaurant-tasks checklist / completion evidence type helpers (MISE-005PV).
 *
 * Pins domain-layer `boundedEvidence` evidence `type` outside the repository
 * graph so Node tests can exercise inventing proofs without loading Supabase
 * or demo storage. Checklist and completion-evidence types previously
 * Unicode-trimmed through `record.type = record.type.trim()`, so NBSP/em-space
 * padding invented a durable evidence-type token before create RPC arguments,
 * completion RPC arguments, or hydrated task rows stored it
 * (`'\u00a0count\u00a0'.trim() === 'count'`).
 *
 * Complements open restaurant-tasks sourceReference tip #820 / MISE-005OL,
 * relatedSupplierName tip #821 / MISE-005OM, title tip #822 / MISE-005ON,
 * detail tip #823 / MISE-005OO, completionResult tip #824 / MISE-005OP,
 * clientTaskId tip #808 / MISE-005NZ, correlationId tip #809 / MISE-005OA,
 * dependencyIds tip #810 / MISE-005OB, assigneeUserId tip #811 / MISE-005OC,
 * relatedInventoryItemId tip #812 / MISE-005OD, relatedOrderId tip #813 /
 * MISE-005OE, relatedRecommendationId tip #814 / MISE-005OF, createdBy tip
 * #815 / MISE-005OG, completedBy tip #816 / MISE-005OH, locationId tip #817 /
 * MISE-005OI, and finding-decision evidence type tip #793 / MISE-005NK without
 * sharing their helper modules or rewriting those paths. Intentionally does
 * not change the soft-empty type → label fallback that invents
 * `checklist_item` when only a label is present, and leaves label emptiness
 * on Unicode `.trim()` (emptiness-only; the trimmed label is not stored).
 * Other `requiredText` / `optionalText` surfaces remain on their existing
 * Unicode-trim contracts in this tip.
 *
 * Evidence types are single-line tokens (for example `count`, `photo`,
 * `manager_review`), not free-form multiline prose. Only ASCII end trim is
 * pinned; case is left unchanged so unknown casing stays operator-faithful.
 * Max length is 80 to match the finding-decision evidence-type bound. Soft
 * empty (ASCII whitespace or Unicode-only space) keeps the prior label
 * fallback path rather than inventing a type from padding.
 */

import { RESTAURANT_TASK_EVIDENCE_TYPE_MAX_CHARACTERS } from "./securityLimits";

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant-task evidence type before it
 * is stored as durable checklist / completion evidence.
 */
export function asciiTrimRestaurantTasksEvidenceTypeToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a restaurant-tasks evidence type under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeRestaurantTasksEvidenceType(
  value: string
): string | null {
  const trimmed = asciiTrimRestaurantTasksEvidenceTypeToken(value);
  if (!trimmed) return null;
  if (trimmed.length > RESTAURANT_TASK_EVIDENCE_TYPE_MAX_CHARACTERS) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed evidence type require for `boundedEvidence` when a type string
 * is present and non-empty under Unicode trim. Preserves the soft-empty →
 * label/`checklist_item` fallback at the call site. Unicode-padded,
 * over-long, control, and non-string tokens fail closed rather than inventing
 * a durable evidence-type key.
 *
 * Error contract: `${label} type is invalid.`
 */
export function requireCanonicalRestaurantTasksEvidenceType(
  value: unknown,
  label: string
): string {
  if (typeof value !== "string") {
    throw new Error(`${label} type is invalid.`);
  }
  const canonical = canonicalizeRestaurantTasksEvidenceType(value);
  if (canonical) return canonical;
  throw new Error(`${label} type is invalid.`);
}

/**
 * Structural audit evidence for inventory ledger source references.
 *
 * Hosted `public.record_inventory_event` already nullif-trims blank
 * `p_source_reference` values before insert. On current main, every other
 * insert path (direct service inserts, count-session approval, demo/outbox
 * accept) can still stamp whitespace-only or padded source_reference text
 * onto the append-only ledger.
 *
 * That invents a parallel identity beside null / the trimmed label: outbox
 * replay then conflicts with the hosted nullif-trim store
 * (`sameEventPayload` treats `"   "` and `null` as different), and Activity /
 * write-path provenance cannot compare blank padding as a real reference.
 *
 * Product writers and `requireInventoryOperation` already trim soft-empty
 * references to null. This tip fails closed when a source_reference is
 * present but blank after trim, or when it retains leading/trailing
 * whitespace. Null remains allowed. Length-only bounds, control-character
 * pins, and ASCII-C operator-path tips stay with their own PRs.
 */

/**
 * Domain rejection reason for blank or padded source references.
 * Returns null when the reference is absent or already trimmed non-empty.
 */
export function validateSourceReferenceEvidence(input: {
  sourceReference: string | null;
}): string | null {
  if (input.sourceReference == null) return null;
  const trimmed = input.sourceReference.trim();
  if (trimmed === "" || input.sourceReference !== trimmed) {
    return "invalid_source_reference_shape";
  }
  return null;
}

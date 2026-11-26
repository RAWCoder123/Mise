/**
 * Structural audit evidence for purchase-line raw_item_description.
 *
 * Hosted `private.purchase_line_text` already btrims `rawItemDescription`
 * before append. Product `boundedText` also trims before normalize. On current
 * main, every other insert path (direct service_role inserts, append helpers
 * that skip the ingest preflight, future writers) can still stamp
 * whitespace-only or padded descriptions onto the append-only ledger because
 * the existing CHECK only requires `length(btrim(...)) between 1 and 500`.
 *
 * `raw_item_description` is the durable source wording for the line and the
 * input to `normalized_item_key`. Padding invents provenance beside the hosted
 * trimmed store even when the normalized key still agrees. Blank padding is
 * already refused by the length-after-trim CHECK with a generic violation;
 * this tip fails closed with an explicit unpadded contract for every insert
 * path. Length-only bounds and control-character pins stay with their own tips.
 */

/**
 * Domain rejection reason for blank or padded raw item descriptions.
 * Returns null when the description is already trimmed and non-empty.
 */
export function validatePurchaseLineRawItemDescriptionEvidence(input: {
  rawItemDescription: string | null | undefined;
}): string | null {
  if (input.rawItemDescription == null) {
    return "invalid_raw_item_description_shape";
  }
  const trimmed = input.rawItemDescription.trim();
  if (trimmed === "" || input.rawItemDescription !== trimmed) {
    return "invalid_raw_item_description_shape";
  }
  return null;
}

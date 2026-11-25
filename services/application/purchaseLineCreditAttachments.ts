import {
  buildPurchaseLineCreditAttachmentCandidates,
  suggestPurchaseLinesForCredit
} from "../domain/purchaseLineCreditAttachments";
import type { PurchaseLine } from "../domain/purchaseLines";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

function requireRestaurantId(restaurantId: string) {
  const normalized = restaurantId.trim();
  if (!normalized) throw new Error("Missing restaurant workspace.");
  return normalized;
}

function requireId(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Missing ${label}.`);
  return normalized;
}

export async function fetchPurchaseLineCreditAttachments(restaurantId: string) {
  return repository.fetchPurchaseLineCreditAttachments(requireRestaurantId(restaurantId));
}

export async function fetchPurchaseLineCreditAttachmentCandidates(restaurantId: string) {
  const scopedRestaurantId = requireRestaurantId(restaurantId);
  const [lines, attachments] = await Promise.all([
    repository.fetchPurchaseLines(scopedRestaurantId),
    repository.fetchPurchaseLineCreditAttachments(scopedRestaurantId)
  ]);
  return buildPurchaseLineCreditAttachmentCandidates(lines, attachments);
}

export async function attachPurchaseLineCredit(input: {
  restaurantId: string;
  creditLineId: string;
  purchaseLineId: string;
}) {
  return repository.attachPurchaseLineCredit({
    restaurantId: requireRestaurantId(input.restaurantId),
    creditLineId: requireId(input.creditLineId, "credit line"),
    purchaseLineId: requireId(input.purchaseLineId, "purchase line")
  });
}

export async function revokePurchaseLineCreditAttachment(
  restaurantId: string,
  attachmentId: string
) {
  return repository.revokePurchaseLineCreditAttachment(
    requireRestaurantId(restaurantId),
    requireId(attachmentId, "purchase line credit attachment")
  );
}

export function suggestPurchaseMatchesForCredit(
  credit: PurchaseLine,
  lines: readonly PurchaseLine[]
) {
  return suggestPurchaseLinesForCredit(credit, lines);
}

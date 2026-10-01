import { createId } from "../domain/miseDomain";
import {
  buildReceiptCorrectionCandidate,
  findCorrectableReceiptEvent,
  listCorrectableOperatorReceipts
} from "../domain/receiptCorrection";
import type { InventoryEvent } from "../domain/inventoryLedger";
import {
  requireReceiptCorrectionInput,
  type ReceiptCorrectionClientInput
} from "../miseValidation";
import type { MiseRepository } from "../repositories/repositoryContracts";
import {
  flushQueuedInventoryEvents,
  queueInventoryEventForSubmission
} from "./deviceInventoryOutbox";
import type { InventoryOutboxFlushSummary } from "./inventoryOutbox";
import { getMiseRepository } from "./repository";

const RECEIPT_CORRECTION_HISTORY_LIMIT = 200;

export type CorrectableOperatorReceipt = {
  event: InventoryEvent;
  itemName: string;
  note: string | null;
};

/**
 * Lists manual Log Delivery receipts that managers can still reverse.
 * Supplier-order receives are excluded; already-corrected rows are hidden.
 */
export async function fetchCorrectableOperatorReceipts(
  restaurantId: string
): Promise<CorrectableOperatorReceipt[]> {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");

  const repository = getMiseRepository();
  const [events, items] = await Promise.all([
    listReceiptCorrectionEvidence(repository, normalizedRestaurantId),
    repository.fetchInventoryItems(normalizedRestaurantId)
  ]);

  if (events.some((event) => event.restaurantId !== normalizedRestaurantId)) {
    throw new Error("Receipt correction received cross-restaurant evidence.");
  }

  const itemNameById = new Map(items.map((item) => [item.id, item.item_name]));
  return listCorrectableOperatorReceipts(events).map((event) => ({
    event,
    itemName: itemNameById.get(event.inventoryItemId) ?? event.inventoryItemId,
    note: noteFromMetadata(event.metadata)
  }));
}

/**
 * Manager reconciliation for a mistaken Log Delivery receipt. Appends a signed
 * `correction` that supersedes the receipt once; on-hand decreases by the
 * receipt quantity. Generic inventory ops still cannot set supersedesEventId;
 * hosted RPC still enforces manager membership.
 */
export async function correctReceiptEvent(
  input: ReceiptCorrectionClientInput
): Promise<InventoryOutboxFlushSummary> {
  const validated = requireReceiptCorrectionInput(input);
  const repository = getMiseRepository();
  const restaurant = await repository.fetchRestaurant(validated.restaurantId);
  if (restaurant.id !== validated.restaurantId) {
    throw new Error("Receipt correction restaurant identity did not match.");
  }

  const events = await listReceiptCorrectionEvidence(repository, validated.restaurantId);
  const receiptEvent = findCorrectableReceiptEvent({
    restaurantId: validated.restaurantId,
    receiptEventId: validated.receiptEventId,
    events
  });
  const candidate = buildReceiptCorrectionCandidate({
    receiptEvent,
    restaurantId: validated.restaurantId,
    note: validated.note,
    effectiveAt: validated.effectiveAt
  });
  const clientEventId = createId("inventory_event");
  await queueInventoryEventForSubmission({
    outboxId: createId("inventory_outbox"),
    event: {
      ...candidate,
      clientEventId,
      idempotencyKey: `receipt_correction:${receiptEvent.id}:${clientEventId}`
    },
    now: validated.effectiveAt
  });
  return flushQueuedInventoryEvents(validated.restaurantId);
}

async function listReceiptCorrectionEvidence(
  repository: MiseRepository,
  normalizedRestaurantId: string
) {
  return repository.listInventoryEvents(normalizedRestaurantId, {
    eventTypes: ["receipt", "correction"],
    limit: RECEIPT_CORRECTION_HISTORY_LIMIT
  });
}

function noteFromMetadata(metadata: Readonly<Record<string, unknown>> | undefined): string | null {
  if (!metadata) return null;
  const note = metadata.note;
  return typeof note === "string" && note.trim() ? note.trim() : null;
}

import {
  createInventoryOutboxEntry,
  type InventoryOutboxEntry
} from "../domain/inventoryOutbox";
import type {
  InventoryEventAcceptance,
  InventoryEventInput
} from "../domain/inventoryLedger";
import { createId } from "../domain/miseDomain";
import {
  requireInventoryOperation,
  type InventoryOperationClientInput
} from "../miseValidation";
import { deviceInventoryOutboxRepository } from "../repositories/deviceInventoryOutboxRepository";
import type { InventoryOutboxRepository } from "../repositories/inventoryOutboxRepository";
import { flushInventoryOutbox } from "./inventoryOutbox";

let activeDeviceOutboxRepository: InventoryOutboxRepository =
  deviceInventoryOutboxRepository;
let activeInventoryEventSubmitter = async (event: InventoryEventInput) => {
  const { getMiseRepository } = await import("./repository");
  return getMiseRepository().recordInventoryEvent(event);
};

export async function queueInventoryEventForSubmission(input: {
  outboxId: string;
  event: InventoryEventInput;
  now?: string;
}): Promise<InventoryOutboxEntry> {
  const entry = createInventoryOutboxEntry({
    id: input.outboxId,
    event: input.event,
    now: input.now ?? new Date().toISOString()
  });
  await activeDeviceOutboxRepository.save(entry);
  return entry;
}

export function queueInventoryOperation(input: InventoryOperationClientInput) {
  const clientEventId = createId("inventory_event");
  const event = requireInventoryOperation(input);
  return queueInventoryEventForSubmission({
    outboxId: createId("inventory_outbox"),
    event: {
      ...event,
      clientEventId,
      idempotencyKey: `inventory:${clientEventId}`
    }
  });
}

export function fetchQueuedInventoryEvents(restaurantId: string) {
  return activeDeviceOutboxRepository.list(restaurantId);
}

/**
 * Screen-safe sync boundary. Provider selection and RPC details stay behind
 * the repository contract; transient failures are deferred by the outbox.
 */
export function flushQueuedInventoryEvents(restaurantId: string) {
  return flushInventoryOutbox({
    restaurantId,
    repository: activeDeviceOutboxRepository,
    submit: (entry) => activeInventoryEventSubmitter(entry.event),
    now: () => new Date().toISOString()
  });
}

/** Test-only seam for a deterministic in-memory device store. */
export function setDeviceInventoryOutboxRepositoryForTesting(
  repository: InventoryOutboxRepository
) {
  const previous = activeDeviceOutboxRepository;
  activeDeviceOutboxRepository = repository;
  return () => {
    activeDeviceOutboxRepository = previous;
  };
}

/** Test-only seam that avoids booting the Expo repository runtime. */
export function setInventoryEventSubmitterForTesting(
  submitter: (event: InventoryEventInput) => Promise<InventoryEventAcceptance>
) {
  const previous = activeInventoryEventSubmitter;
  activeInventoryEventSubmitter = submitter;
  return () => {
    activeInventoryEventSubmitter = previous;
  };
}

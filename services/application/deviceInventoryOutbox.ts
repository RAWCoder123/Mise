import {
  createInventoryOutboxEntry,
  type InventoryOutboxEntry
} from "../domain/inventoryOutbox";
import type { InventoryEventInput } from "../domain/inventoryLedger";
import { deviceInventoryOutboxRepository } from "../repositories/deviceInventoryOutboxRepository";
import type { InventoryOutboxRepository } from "../repositories/inventoryOutboxRepository";

let activeDeviceOutboxRepository: InventoryOutboxRepository =
  deviceInventoryOutboxRepository;

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

export function fetchQueuedInventoryEvents(restaurantId: string) {
  return activeDeviceOutboxRepository.list(restaurantId);
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

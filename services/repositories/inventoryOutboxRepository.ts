import type { InventoryOutboxEntry } from "../domain/inventoryOutbox";

export interface InventoryOutboxStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface InventoryOutboxRepository {
  list(restaurantId: string): Promise<InventoryOutboxEntry[]>;
  save(entry: InventoryOutboxEntry): Promise<void>;
}

const defaultKeyPrefix = "mise.inventory-outbox.v1";

export function createInventoryOutboxRepository(
  storage: InventoryOutboxStorage,
  keyPrefix = defaultKeyPrefix
): InventoryOutboxRepository {
  let operationQueue: Promise<unknown> = Promise.resolve();
  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const pending = operationQueue.then(operation, operation);
    operationQueue = pending.then(
      () => undefined,
      () => undefined
    );
    return pending;
  }

  return {
    list(restaurantId) {
      return enqueue(async () => {
        const key = storageKey(keyPrefix, restaurantId);
        const raw = await storage.getItem(key);
        if (raw === null) return [];
        return parseEntries(raw, restaurantId);
      });
    },
    save(entry) {
      return enqueue(async () => {
        const key = storageKey(keyPrefix, entry.event.restaurantId);
        const existing = await readEntries(storage, key, entry.event.restaurantId);
        const previous = existing.find((candidate) => candidate.id === entry.id);
        if (
          previous &&
          (previous.event.clientEventId !== entry.event.clientEventId ||
            previous.event.idempotencyKey !== entry.event.idempotencyKey)
        ) {
          throw new Error("outbox_entry_identity_conflict");
        }
        const next = [
          ...existing.filter((candidate) => candidate.id !== entry.id),
          entry
        ].sort(
          (left, right) =>
            Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
            left.id.localeCompare(right.id)
        );
        await storage.setItem(key, JSON.stringify(next));
      });
    }
  };
}

async function readEntries(
  storage: InventoryOutboxStorage,
  key: string,
  restaurantId: string
) {
  const raw = await storage.getItem(key);
  return raw === null ? [] : parseEntries(raw, restaurantId);
}

function parseEntries(raw: string, restaurantId: string): InventoryOutboxEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("inventory_outbox_corrupt");
  }
  if (!Array.isArray(parsed) || !parsed.every(isInventoryOutboxEntry)) {
    throw new Error("inventory_outbox_corrupt");
  }
  if (parsed.some((entry) => entry.event.restaurantId !== restaurantId)) {
    throw new Error("inventory_outbox_tenant_mismatch");
  }
  return parsed;
}

function isInventoryOutboxEntry(value: unknown): value is InventoryOutboxEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<InventoryOutboxEntry>;
  const event =
    entry.event && typeof entry.event === "object"
      ? (entry.event as Partial<InventoryOutboxEntry["event"]>)
      : null;
  return (
    typeof entry.id === "string" &&
    (entry.status === "pending" ||
      entry.status === "submitting" ||
      entry.status === "accepted" ||
      entry.status === "conflict" ||
      entry.status === "rejected") &&
    Number.isInteger(entry.attemptCount) &&
    typeof entry.createdAt === "string" &&
    Number.isFinite(Date.parse(entry.createdAt)) &&
    typeof entry.updatedAt === "string" &&
    Number.isFinite(Date.parse(entry.updatedAt)) &&
    (entry.nextAttemptAt === null ||
      (typeof entry.nextAttemptAt === "string" &&
        Number.isFinite(Date.parse(entry.nextAttemptAt)))) &&
    event !== null &&
    typeof event.restaurantId === "string" &&
    event.restaurantId.length > 0 &&
    typeof event.inventoryItemId === "string" &&
    event.inventoryItemId.length > 0 &&
    typeof event.clientEventId === "string" &&
    event.clientEventId.length > 0 &&
    typeof event.idempotencyKey === "string" &&
    event.idempotencyKey.length > 0
  );
}

function storageKey(keyPrefix: string, restaurantId: string) {
  if (!keyPrefix.trim()) throw new Error("missing_outbox_key_prefix");
  if (!/^[A-Za-z0-9_-]+$/.test(restaurantId)) {
    throw new Error("invalid_outbox_restaurant_id");
  }
  return `${keyPrefix}:${restaurantId}`;
}

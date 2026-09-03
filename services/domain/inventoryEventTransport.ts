import type {
  InventoryEvent,
  InventoryEventAcceptance,
  InventoryEventInput,
  InventoryEventType
} from "./inventoryLedger";
import { acceptInventoryEvent } from "./inventoryLedger";

const eventTypes = new Set<InventoryEventType>([
  "receipt",
  "count",
  "waste",
  "stockout",
  "usage",
  "adjustment",
  "transfer",
  "correction"
]);

/**
 * Converts the PostgREST representation returned by record_inventory_event
 * into the domain shape. This is deliberately strict so a malformed or stale
 * RPC contract is retried instead of being recorded as accepted on-device.
 */
export function normalizeInventoryEventRecord(value: unknown): InventoryEvent {
  const record = unwrapRecord(value);
  const eventType = requireString(record.event_type, "event_type");
  if (!eventTypes.has(eventType as InventoryEventType)) {
    throw new Error("inventory_rpc_invalid_event_type");
  }
  const canonicalUnit = requireString(record.canonical_unit, "canonical_unit");
  if (canonicalUnit !== "g" && canonicalUnit !== "ml" && canonicalUnit !== "each") {
    throw new Error("inventory_rpc_invalid_canonical_unit");
  }

  const sequence = Number(record.sequence);
  const quantity = Number(record.quantity);
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new Error("inventory_rpc_invalid_sequence");
  }
  if (!Number.isFinite(quantity)) throw new Error("inventory_rpc_invalid_quantity");

  return {
    id: requireString(record.id, "id"),
    sequence,
    restaurantId: requireString(record.restaurant_id, "restaurant_id"),
    inventoryItemId: requireString(record.inventory_item_id, "inventory_item_id"),
    eventType: eventType as InventoryEventType,
    quantity,
    canonicalUnit,
    projectionApplied: record.projection_applied === false ? false : true,
    effectiveAt: requireTimestamp(record.effective_at, "effective_at"),
    recordedAt: requireTimestamp(record.recorded_at, "recorded_at"),
    actorUserId: optionalString(record.actor_user_id),
    source: requireString(record.source, "source"),
    sourceReference: optionalString(record.source_reference),
    reasonCode: optionalString(record.reason_code),
    clientEventId: requireString(record.client_event_id, "client_event_id"),
    idempotencyKey: requireString(record.idempotency_key, "idempotency_key"),
    supersedesEventId: optionalString(record.supersedes_event_id),
    metadata: normalizeMetadata(record.metadata)
  };
}

/**
 * Only deterministic database rejections become terminal outbox results.
 * Authentication, authorization, connectivity, and unknown server errors
 * return null so the caller can surface or retry them.
 */
export function inventoryEventRejectionFromRpcError(
  error: unknown
): InventoryEventAcceptance | null {
  const record = isRecord(error) ? error : {};
  const code = typeof record.code === "string" ? record.code : "";
  const message = typeof record.message === "string" ? record.message.toLowerCase() : "";

  if (code === "23505") {
    return {
      status: "conflict",
      reason: message.includes("already been superseded")
        ? "event_already_superseded"
        : "idempotency_payload_mismatch",
      existingEvent: null
    };
  }
  if (code === "23503") {
    return {
      status: "conflict",
      reason: message.includes("superseded")
        ? "superseded_event_not_found"
        : "inventory_item_not_found",
      existingEvent: null
    };
  }
  if (code === "22023") {
    return {
      status: "rejected",
      reason: rejectionReason(message)
    };
  }
  return null;
}

export function inventoryEventRpcArguments(input: InventoryEventInput) {
  return {
    p_restaurant_id: input.restaurantId,
    p_inventory_item_id: input.inventoryItemId,
    p_event_type: input.eventType,
    p_quantity: input.quantity,
    p_canonical_unit: input.canonicalUnit,
    p_effective_at: input.effectiveAt,
    p_source: input.source,
    p_client_event_id: input.clientEventId,
    p_idempotency_key: input.idempotencyKey,
    p_source_reference: input.sourceReference,
    p_reason_code: input.reasonCode,
    p_supersedes_event_id: input.supersedesEventId,
    p_metadata: input.metadata
  };
}

export function createInMemoryInventoryEventRecorder(input: {
  actorUserId: string;
  idFor: (event: InventoryEventInput) => string;
  now?: () => string;
}) {
  const events: InventoryEvent[] = [];

  async function record(candidate: InventoryEventInput): Promise<InventoryEventAcceptance> {
    const acceptance = acceptInventoryEvent({
      existingEvents: events,
      candidate,
      authority: {
        id: input.idFor(candidate),
        actorUserId: input.actorUserId,
        recordedAt: (input.now ?? (() => new Date().toISOString()))()
      }
    });
    if (acceptance.status === "accepted") events.push(acceptance.event);
    return acceptance;
  }

  function list(options?: {
    restaurantId?: string;
    eventTypes?: InventoryEventType[];
    limit?: number;
    since?: string;
  }): InventoryEvent[] {
    let filtered = [...events];
    if (options?.restaurantId) {
      filtered = filtered.filter((event) => event.restaurantId === options.restaurantId);
    }
    if (options?.eventTypes?.length) {
      const allowed = new Set(options.eventTypes);
      filtered = filtered.filter((event) => allowed.has(event.eventType));
    }
    if (options?.since) {
      const sinceMs = Date.parse(options.since);
      if (Number.isFinite(sinceMs)) {
        filtered = filtered.filter((event) => Date.parse(event.recordedAt) >= sinceMs);
      }
    }
    filtered.sort(
      (left, right) =>
        Date.parse(right.recordedAt) - Date.parse(left.recordedAt) ||
        right.sequence - left.sequence ||
        left.id.localeCompare(right.id)
    );
    if (options?.limit != null && Number.isFinite(options.limit) && options.limit >= 0) {
      return filtered.slice(0, options.limit);
    }
    return filtered;
  }

  return { record, list };
}

function unwrapRecord(value: unknown): Record<string, unknown> {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!isRecord(candidate)) throw new Error("inventory_rpc_invalid_response");
  return candidate;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`inventory_rpc_invalid_${field}`);
  }
  return value;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function requireTimestamp(value: unknown, field: string) {
  const timestamp = requireString(value, field);
  if (!Number.isFinite(Date.parse(timestamp))) {
    throw new Error(`inventory_rpc_invalid_${field}`);
  }
  return timestamp;
}

function normalizeMetadata(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || value === undefined) return {};
  if (!isRecord(value)) throw new Error("inventory_rpc_invalid_metadata");
  return Object.freeze({ ...value });
}

function rejectionReason(message: string) {
  if (message.includes("canonical unit")) return "invalid_canonical_unit";
  if (message.includes("source is too long")) return "source_too_long";
  if (message.includes("client event id is too long")) return "client_event_id_too_long";
  if (message.includes("idempotency key is too long")) return "idempotency_key_too_long";
  if (message.includes("quantity")) return "invalid_quantity";
  if (message.includes("event type")) return "unsupported_event_type";
  if (message.includes("evidence")) return "incomplete_evidence";
  return "invalid_inventory_event";
}

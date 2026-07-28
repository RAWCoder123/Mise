import type { FindingDecisionOutboxEntry } from "../domain/findingDecisionOutbox";
import { normalizeOperationalFindingDecisionInput } from "../domain/operationalFindingDecisions";

export interface FindingDecisionOutboxStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface FindingDecisionOutboxRepository {
  list(restaurantId: string): Promise<FindingDecisionOutboxEntry[]>;
  save(entry: FindingDecisionOutboxEntry): Promise<void>;
}

const defaultKeyPrefix = "mise.finding-decision-outbox.v1";

export function createFindingDecisionOutboxRepository(
  storage: FindingDecisionOutboxStorage,
  keyPrefix = defaultKeyPrefix
): FindingDecisionOutboxRepository {
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
      return enqueue(async () => readEntries(storage, storageKey(keyPrefix, restaurantId), restaurantId));
    },
    save(entry) {
      return enqueue(async () => {
        const restaurantId = entry.decision.restaurantId;
        const key = storageKey(keyPrefix, restaurantId);
        const existing = await readEntries(storage, key, restaurantId);
        const previous = existing.find((candidate) => candidate.id === entry.id);
        if (previous && decisionIdentity(previous) !== decisionIdentity(entry)) {
          throw new Error("finding_decision_outbox_identity_conflict");
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
  storage: FindingDecisionOutboxStorage,
  key: string,
  restaurantId: string
) {
  const raw = await storage.getItem(key);
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("finding_decision_outbox_corrupt");
  }
  if (!Array.isArray(parsed) || !parsed.every(isFindingDecisionOutboxEntry)) {
    throw new Error("finding_decision_outbox_corrupt");
  }
  try {
    parsed.forEach((entry) => normalizeOperationalFindingDecisionInput(entry.decision));
  } catch {
    throw new Error("finding_decision_outbox_corrupt");
  }
  if (parsed.some((entry) => entry.decision.restaurantId !== restaurantId)) {
    throw new Error("finding_decision_outbox_tenant_mismatch");
  }
  return parsed;
}

function isFindingDecisionOutboxEntry(value: unknown): value is FindingDecisionOutboxEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<FindingDecisionOutboxEntry>;
  const decision =
    entry.decision && typeof entry.decision === "object"
      ? (entry.decision as Partial<FindingDecisionOutboxEntry["decision"]>)
      : null;
  const finding =
    decision?.finding && typeof decision.finding === "object"
      ? (decision.finding as Partial<FindingDecisionOutboxEntry["decision"]["finding"]>)
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
      (typeof entry.nextAttemptAt === "string" && Number.isFinite(Date.parse(entry.nextAttemptAt)))) &&
    decision !== null &&
    typeof decision.restaurantId === "string" &&
    typeof decision.clientEventId === "string" &&
    typeof decision.idempotencyKey === "string" &&
    decision.clientEventId.length > 0 &&
    decision.idempotencyKey.length > 0 &&
    finding !== null &&
    typeof finding.id === "string" &&
    typeof finding.policyVersion === "string"
  );
}

function decisionIdentity(entry: FindingDecisionOutboxEntry) {
  return JSON.stringify({
    restaurantId: entry.decision.restaurantId,
    findingId: entry.decision.finding.id,
    policyVersion: entry.decision.finding.policyVersion,
    decisionType: entry.decision.decisionType,
    editedRecommendedAction: entry.decision.editedRecommendedAction ?? null,
    clientEventId: entry.decision.clientEventId,
    idempotencyKey: entry.decision.idempotencyKey
  });
}

function storageKey(keyPrefix: string, restaurantId: string) {
  if (!keyPrefix.trim()) throw new Error("missing_finding_decision_outbox_key_prefix");
  if (!/^[A-Za-z0-9_-]+$/.test(restaurantId)) {
    throw new Error("invalid_finding_decision_outbox_restaurant_id");
  }
  return `${keyPrefix}:${restaurantId}`;
}

import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchQueuedOperationalFindingDecisions,
  flushQueuedOperationalFindingDecisions,
  queueOperationalFindingDecision,
  setFindingDecisionOutboxRepositoryForTesting,
  setFindingDecisionSubmitterForTesting
} from "../services/application/findingDecisionOutbox";
import {
  beginFindingDecisionSubmission,
  createFindingDecisionOutboxEntry
} from "../services/domain/findingDecisionOutbox";
import type {
  OperationalFindingDecision,
  OperationalFindingDecisionInput
} from "../services/domain/operationalFindingDecisions";
import type { OperationalFinding } from "../services/domain/operationalFindings";
import {
  createFindingDecisionOutboxRepository,
  type FindingDecisionOutboxStorage
} from "../services/repositories/findingDecisionOutboxRepository";

const restaurantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const finding: OperationalFinding = {
  id: "finding:data-gap:sales:2026-07-28",
  restaurantId,
  category: "data_quality",
  severity: "warning",
  priority: "up_next",
  title: "Today’s sales are missing",
  explanation: "No sales rows are recorded for this operating date.",
  confidence: {
    score: 1,
    rationale: "No restaurant-scoped sales rows exist."
  },
  evidence: [{
    type: "data_gap",
    id: "sales:2026-07-28",
    observedAt: "2026-07-28T00:00:00.000Z",
    summary: "No sales rows are recorded for 2026-07-28."
  }],
  affectedWorkflow: "daily_sales_import",
  recommendedAction: "Import or enter today’s sales, then refresh the daily brief.",
  sourceWindow: {
    start: "2026-07-28T00:00:00.000Z",
    end: "2026-07-28T00:00:00.000Z"
  },
  generatedAt: "2026-07-28T12:00:00.000Z",
  freshness: {
    state: "incomplete",
    asOf: "2026-07-28T12:00:00.000Z",
    staleAfter: "2026-07-28T14:00:00.000Z",
    missingData: ["daily_sales"]
  },
  managerFeedback: {
    state: "unreviewed",
    decisionId: null,
    recordedAt: null,
    effectiveRecommendedAction: "Import or enter today’s sales, then refresh the daily brief."
  },
  policyVersion: "beta-findings-v1"
};

function memoryStorage(): FindingDecisionOutboxStorage {
  const values = new Map<string, string>();
  return {
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    }
  };
}

function authoritative(
  input: OperationalFindingDecisionInput
): OperationalFindingDecision {
  return {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    sequence: 1,
    restaurantId: input.restaurantId,
    findingId: input.finding.id,
    policyVersion: input.finding.policyVersion,
    decisionType: input.decisionType,
    findingGeneratedAt: input.finding.generatedAt,
    findingCategory: input.finding.category,
    severity: input.finding.severity,
    confidenceScore: input.finding.confidence.score,
    evidence: input.finding.evidence,
    originalRecommendedAction: input.finding.recommendedAction,
    editedRecommendedAction: input.editedRecommendedAction ?? null,
    clientEventId: input.clientEventId,
    idempotencyKey: input.idempotencyKey,
    actorUserId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    recordedAt: "2026-07-28T12:01:00.000Z"
  };
}

test("device feedback queue persists one stable retry identity by tenant", async () => {
  const storage = memoryStorage();
  const repository = createFindingDecisionOutboxRepository(storage);
  const restore = setFindingDecisionOutboxRepositoryForTesting(repository);
  try {
    const queued = await queueOperationalFindingDecision({
      finding,
      decisionType: "approved",
      now: "2026-07-28T12:00:30.000Z"
    });
    assert.match(queued.id, /^finding_decision_outbox_/);
    assert.match(queued.decision.clientEventId, /^finding_decision_/);
    assert.equal(
      queued.decision.idempotencyKey,
      `finding-decision:${queued.decision.clientEventId}`
    );

    const restarted = createFindingDecisionOutboxRepository(storage);
    assert.deepEqual(
      (await restarted.list(restaurantId)).map((entry) => ({
        id: entry.id,
        clientEventId: entry.decision.clientEventId,
        idempotencyKey: entry.decision.idempotencyKey
      })),
      [{
        id: queued.id,
        clientEventId: queued.decision.clientEventId,
        idempotencyKey: queued.decision.idempotencyKey
      }]
    );
    assert.deepEqual(await restarted.list("dddddddd-dddd-4ddd-8ddd-dddddddddddd"), []);
  } finally {
    restore();
  }
});

test("flush settles the exact authoritative decision and preserves identity", async () => {
  const repository = createFindingDecisionOutboxRepository(memoryStorage());
  const restoreRepository = setFindingDecisionOutboxRepositoryForTesting(repository);
  const restoreSubmitter = setFindingDecisionSubmitterForTesting(async (input) =>
    authoritative(input)
  );
  try {
    const queued = await queueOperationalFindingDecision({
      finding,
      decisionType: "dismissed",
      now: "2020-01-01T00:00:00.000Z"
    });
    const summary = await flushQueuedOperationalFindingDecisions(restaurantId);
    const [settled] = await fetchQueuedOperationalFindingDecisions(restaurantId);

    assert.deepEqual(summary, {
      considered: 1,
      accepted: 1,
      conflicted: 0,
      rejected: 0,
      deferred: 0
    });
    assert.equal(settled?.status, "accepted");
    assert.equal(
      settled?.authoritativeDecision?.clientEventId,
      queued.decision.clientEventId
    );
    assert.equal(
      settled?.authoritativeDecision?.idempotencyKey,
      queued.decision.idempotencyKey
    );
  } finally {
    restoreSubmitter();
    restoreRepository();
  }
});

test("ambiguous transport failure remains retryable with the original identity", async () => {
  const repository = createFindingDecisionOutboxRepository(memoryStorage());
  const restoreRepository = setFindingDecisionOutboxRepositoryForTesting(repository);
  const restoreSubmitter = setFindingDecisionSubmitterForTesting(async () => {
    throw new TypeError("network unavailable");
  });
  try {
    const queued = await queueOperationalFindingDecision({
      finding,
      decisionType: "approved",
      now: "2020-01-01T00:00:00.000Z"
    });
    const summary = await flushQueuedOperationalFindingDecisions(restaurantId);
    const [deferred] = await fetchQueuedOperationalFindingDecisions(restaurantId);

    assert.equal(summary.deferred, 1);
    assert.equal(deferred?.status, "pending");
    assert.equal(deferred?.resolutionReason, "network_retry");
    assert.equal(deferred?.decision.clientEventId, queued.decision.clientEventId);
    assert.equal(deferred?.decision.idempotencyKey, queued.decision.idempotencyKey);
  } finally {
    restoreSubmitter();
    restoreRepository();
  }
});

test("idempotency conflict and permission denial settle visibly instead of retrying", async () => {
  for (const scenario of [
    {
      error: new Error("Operational finding decision idempotency conflict."),
      status: "conflict",
      reason: "idempotency_payload_mismatch"
    },
    {
      error: Object.assign(new Error("permission denied"), { code: "42501" }),
      status: "rejected",
      reason: "permission_denied"
    }
  ] as const) {
    const repository = createFindingDecisionOutboxRepository(memoryStorage());
    const restoreRepository = setFindingDecisionOutboxRepositoryForTesting(repository);
    const restoreSubmitter = setFindingDecisionSubmitterForTesting(async () => {
      throw scenario.error;
    });
    try {
      await queueOperationalFindingDecision({
        finding,
        decisionType: "approved",
        now: "2020-01-01T00:00:00.000Z"
      });
      await flushQueuedOperationalFindingDecisions(restaurantId);
      const [settled] = await fetchQueuedOperationalFindingDecisions(restaurantId);
      assert.equal(settled?.status, scenario.status);
      assert.equal(settled?.resolutionReason, scenario.reason);
      assert.equal(settled?.nextAttemptAt, null);
    } finally {
      restoreSubmitter();
      restoreRepository();
    }
  }
});

test("one local outbox identity cannot be reused for another feedback payload", async () => {
  const repository = createFindingDecisionOutboxRepository(memoryStorage());
  const first = createFindingDecisionOutboxEntry({
    id: "finding-outbox-1",
    now: "2026-07-28T12:00:30.000Z",
    decision: {
      restaurantId,
      finding,
      decisionType: "approved",
      clientEventId: "finding-decision-1",
      idempotencyKey: "finding-decision:finding-decision-1"
    }
  });
  await repository.save(first);
  await assert.rejects(
    repository.save({
      ...first,
      decision: {
        ...first.decision,
        decisionType: "dismissed"
      }
    }),
    /identity_conflict/
  );
});

test("an interrupted submission is recovered and retried with the same authority", async () => {
  const repository = createFindingDecisionOutboxRepository(memoryStorage());
  const restoreRepository = setFindingDecisionOutboxRepositoryForTesting(repository);
  const restoreSubmitter = setFindingDecisionSubmitterForTesting(async (input) =>
    authoritative(input)
  );
  try {
    const pending = createFindingDecisionOutboxEntry({
      id: "finding-outbox-interrupted",
      now: "2020-01-01T00:00:00.000Z",
      decision: {
        restaurantId,
        finding,
        decisionType: "approved",
        clientEventId: "finding-decision-interrupted",
        idempotencyKey: "finding-decision:finding-decision-interrupted"
      }
    });
    await repository.save(
      beginFindingDecisionSubmission(pending, "2020-01-01T00:00:01.000Z")
    );

    const summary = await flushQueuedOperationalFindingDecisions(restaurantId);
    const [settled] = await repository.list(restaurantId);

    assert.equal(summary.accepted, 1);
    assert.equal(settled?.status, "accepted");
    assert.equal(settled?.attemptCount, 2);
    assert.equal(
      settled?.authoritativeDecision?.clientEventId,
      "finding-decision-interrupted"
    );
  } finally {
    restoreSubmitter();
    restoreRepository();
  }
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  latestMatchingQueueEntry,
  queuedFindingMatchesCurrent
} from "../components/dailyBrief/findingQueueMatch";
import type { FindingDecisionOutboxEntry } from "../services/domain/findingDecisionOutbox";
import type { OperationalFinding } from "../services/domain/operationalFindings";

function source(path: string) {
  return readFileSync(path, "utf8");
}

function sampleFinding(overrides: Partial<OperationalFinding> = {}): OperationalFinding {
  return {
    id: "finding:inventory:low-stock",
    restaurantId: "restaurant-a",
    category: "inventory",
    severity: "warning",
    priority: "now",
    title: "Low basil",
    explanation: "Projected coverage is thin.",
    confidence: { score: 0.82, rationale: "Stable recent usage" },
    evidence: [
      {
        type: "inventory_item",
        id: "item-basil",
        observedAt: "2026-07-28T12:00:00.000Z",
        summary: "On hand 0.4 kg"
      }
    ],
    affectedWorkflow: "inventory",
    recommendedAction: "Count basil before dinner service",
    sourceWindow: {
      start: "2026-07-27T00:00:00.000Z",
      end: "2026-07-28T00:00:00.000Z"
    },
    generatedAt: "2026-07-28T08:00:00.000Z",
    freshness: {
      state: "fresh",
      asOf: "2026-07-28T08:00:00.000Z",
      staleAfter: "2026-07-30T08:00:00.000Z",
      missingData: []
    },
    managerFeedback: {
      state: "unreviewed",
      decisionId: null,
      recordedAt: null,
      effectiveRecommendedAction: "Count basil before dinner service"
    },
    policyVersion: "beta-findings-v1",
    ...overrides
  };
}

function sampleQueueEntry(
  finding: OperationalFinding,
  overrides: Partial<FindingDecisionOutboxEntry> = {}
): FindingDecisionOutboxEntry {
  return {
    id: "finding_decision_outbox_1",
    decision: {
      restaurantId: finding.restaurantId,
      finding,
      decisionType: "approved",
      editedRecommendedAction: null,
      clientEventId: "finding_decision_1",
      idempotencyKey: "finding-decision:finding_decision_1"
    },
    status: "accepted",
    attemptCount: 1,
    createdAt: "2026-07-28T08:05:00.000Z",
    updatedAt: "2026-07-28T08:05:30.000Z",
    nextAttemptAt: null,
    authoritativeDecision: null,
    resolutionReason: null,
    ...overrides
  };
}

test("daily brief UI uses screen-safe brief and finding-feedback facades", () => {
  const today = source("app/(tabs)/today.tsx");
  const insights = source("app/(tabs)/insights.tsx");
  const board = source("components/dailyBrief/DailyBriefBoard.tsx");
  const matchHelper = source("components/dailyBrief/findingQueueMatch.ts");
  const catalog = source("i18n/catalog.ts");

  for (const [name, screen] of Object.entries({ today, insights })) {
    assert.match(screen, /fetchDailyOperationalBrief/, `${name} loads daily brief`);
    assert.match(screen, /queueOperationalFindingDecision/, `${name} queues feedback`);
    assert.match(screen, /fetchQueuedOperationalFindingDecisions/, `${name} reads feedback queue`);
    assert.match(screen, /flushQueuedOperationalFindingDecisions/, `${name} flushes feedback queue`);
    assert.match(screen, /canManageRestaurantData/, `${name} gates manager feedback`);
    assert.match(screen, /DailyBriefBoard/, `${name} renders daily brief board`);
    assert.match(screen, /AppState\.addEventListener\("change"/, `${name} flushes on resume`);
    assert.doesNotMatch(screen, /recordOperationalFindingDecision/, `${name} avoids direct record`);
    assert.doesNotMatch(screen, /getMiseRepository|from "\.\.\/\.\.\/services\/repositories/, `${name} avoids repositories`);
  }

  assert.match(board, /managerFeedback\.effectiveRecommendedAction/);
  assert.match(board, /finding\.recommendedAction/);
  assert.match(board, /dailyBrief\.feedbackDisclaimer/);
  assert.match(board, /from "\.\/findingQueueMatch"/);
  assert.match(board, /latestMatchingQueueEntry/);
  assert.match(matchHelper, /queuedFindingMatchesCurrent/);
  assert.match(board, /accessibilityRole="header"/);
  assert.match(board, /approveAccessibility/);
  assert.match(board, /editAccessibility/);
  assert.match(board, /dismissAccessibility/);
  assert.doesNotMatch(
    board,
    /<View[\s\S]*?style=\{\[styles\.card[\s\S]*?accessible\b/,
    "FindingCard must not set accessible on the outer card View"
  );
  assert.match(catalog, /"dailyBrief\.title":/);
  assert.match(catalog, /"dailyBrief\.feedbackDisclaimer":/);
  assert.equal((catalog.match(/"dailyBrief\.title":/g) || []).length, 3);
});

test("queue badges require an exact finding snapshot match", () => {
  const current = sampleFinding();
  const matchingQueued = sampleFinding();
  const changedEvidence = sampleFinding({
    evidence: [
      {
        type: "inventory_item",
        id: "item-basil",
        observedAt: "2026-07-28T15:00:00.000Z",
        summary: "On hand 0.1 kg"
      }
    ]
  });
  const changedAction = sampleFinding({
    recommendedAction: "Order one case of basil"
  });
  const changedPolicy = {
    ...sampleFinding(),
    policyVersion: "beta-findings-v2"
  } as unknown as OperationalFinding;
  const changedSourceWindow = sampleFinding({
    sourceWindow: {
      start: "2026-07-28T00:00:00.000Z",
      end: "2026-07-29T00:00:00.000Z"
    }
  });

  assert.equal(queuedFindingMatchesCurrent(current, matchingQueued), true);
  assert.equal(queuedFindingMatchesCurrent(current, changedEvidence), false);
  assert.equal(queuedFindingMatchesCurrent(current, changedAction), false);
  assert.equal(queuedFindingMatchesCurrent(current, changedPolicy), false);
  assert.equal(queuedFindingMatchesCurrent(current, changedSourceWindow), false);

  const acceptedOld = sampleQueueEntry(changedEvidence, {
    id: "outbox-old",
    status: "accepted",
    updatedAt: "2026-07-28T09:00:00.000Z"
  });
  const pendingExact = sampleQueueEntry(current, {
    id: "outbox-exact",
    status: "pending",
    updatedAt: "2026-07-28T10:00:00.000Z"
  });

  assert.equal(latestMatchingQueueEntry(current, [acceptedOld]), null);
  assert.equal(latestMatchingQueueEntry(current, [acceptedOld, pendingExact])?.id, "outbox-exact");
  assert.equal(latestMatchingQueueEntry(changedEvidence, [acceptedOld])?.id, "outbox-old");
});

test("restaurant export UI is owner/admin-only and never logs payloads", () => {
  const settings = source("app/(tabs)/settings.tsx");
  const exportScreen = source("app/settings/export.tsx");
  const catalog = source("i18n/catalog.ts");

  assert.match(settings, /canDeleteRestaurantData\(memberships, restaurant\?\.id\)/);
  assert.match(settings, /router\.push\("\/settings\/export"/);
  assert.match(exportScreen, /exportRestaurantData\(restaurantId\)/);
  assert.match(exportScreen, /canDeleteRestaurantData\(memberships, restaurant\?\.id\)/);
  assert.match(exportScreen, /expo-file-system\/legacy/);
  assert.match(exportScreen, /expo-sharing/);
  assert.match(exportScreen, /mise-restaurant-export-/);
  assert.match(exportScreen, /Platform\.OS === "web"/);
  assert.match(exportScreen, /activeRestaurantIdRef\.current !== restaurantId/);
  assert.doesNotMatch(exportScreen, /console\.(log|debug|info|warn)\(/);
  assert.doesNotMatch(exportScreen, /JSON\.stringify\(payload\).{0,40}console/);
  assert.match(catalog, /"export\.retention\.body":/);
  assert.match(catalog, /Provider credentials and private security logs are excluded/);
  assert.equal((catalog.match(/"export\.title":/g) || []).length, 3);
});

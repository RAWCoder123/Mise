import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createFindingDecisionOutboxEntry } from "../services/domain/findingDecisionOutbox";
import {
  asciiTrimFindingDecisionOutboxIdToken,
  canonicalizeFindingDecisionOutboxId,
  requireCanonicalFindingDecisionOutboxId
} from "../services/domain/findingDecisionOutboxIdentity";
import type { OperationalFindingDecisionInput } from "../services/domain/operationalFindingDecisions";
import type { OperationalFinding } from "../services/domain/operationalFindings";

const identitySource = readFileSync(
  new URL("../services/domain/findingDecisionOutboxIdentity.ts", import.meta.url),
  "utf8"
);
const outboxSource = readFileSync(
  new URL("../services/domain/findingDecisionOutbox.ts", import.meta.url),
  "utf8"
);

const outboxId = "finding-outbox-1";
const productionShapedId =
  "finding_decision_outbox_00000000-0000-4000-8000-000000000701";

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
  evidence: [
    {
      type: "data_gap",
      id: "sales:2026-07-28",
      observedAt: "2026-07-28T00:00:00.000Z",
      summary: "No sales rows are recorded for 2026-07-28."
    }
  ],
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
    effectiveRecommendedAction:
      "Import or enter today’s sales, then refresh the daily brief."
  },
  policyVersion: "beta-findings-v1"
};

function decision(
  overrides: Partial<OperationalFindingDecisionInput> = {}
): OperationalFindingDecisionInput {
  return {
    restaurantId,
    finding,
    decisionType: "approved",
    clientEventId: "client-event-1",
    idempotencyKey: "finding-decision:client-event-1",
    ...overrides
  };
}

test("MISE-005NC pins finding decision outbox entry id to ASCII C", () => {
  assert.match(identitySource, /MISE-005NC/);
  assert.match(outboxSource, /MISE-005NC/);

  assert.match(
    identitySource,
    /export function asciiTrimFindingDecisionOutboxIdToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(outboxSource, /requireCanonicalFindingDecisionOutboxId\(input\.id\)/);
  assert.match(outboxSource, /from "\.\/findingDecisionOutboxIdentity"/);
  assert.doesNotMatch(outboxSource, /input\.id\.trim\(\)/);

  // Do not rewrite sibling inventory outbox tip #784.
  assert.doesNotMatch(outboxSource, /inventoryOutboxIdentity/);
  assert.doesNotMatch(identitySource, /inventoryOutboxIdentity/);
  assert.doesNotMatch(identitySource, /inventoryLedgerObjectIdentity/);
  assert.doesNotMatch(identitySource, /inventoryLedgerRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /inventoryLedgerSourceIdentity/);
  assert.doesNotMatch(identitySource, /RestaurantIdentity/);

  // Open sibling helper (when present on disk) must stay untouched by this tip.
  try {
    const inventoryOutboxIdentity = readFileSync(
      new URL("../services/domain/inventoryOutboxIdentity.ts", import.meta.url),
      "utf8"
    );
    assert.doesNotMatch(inventoryOutboxIdentity, /MISE-005NC/);
    assert.doesNotMatch(inventoryOutboxIdentity, /FindingDecisionOutbox/);
  } catch {
    // Inventory-outbox helper lands with #784; absence on main is expected.
  }
});

test("ASCII trim keeps ordinary finding decision outbox id padding stable", () => {
  assert.equal(asciiTrimFindingDecisionOutboxIdToken(`  ${outboxId}  `), outboxId);
  assert.equal(canonicalizeFindingDecisionOutboxId(`\t${outboxId}\n`), outboxId);
  assert.equal(requireCanonicalFindingDecisionOutboxId(` ${outboxId} `), outboxId);

  assert.equal(
    asciiTrimFindingDecisionOutboxIdToken(`  ${productionShapedId}  `),
    productionShapedId
  );
  assert.equal(
    canonicalizeFindingDecisionOutboxId(`\t${productionShapedId}\n`),
    productionShapedId
  );
  assert.equal(
    requireCanonicalFindingDecisionOutboxId(` ${productionShapedId} `),
    productionShapedId
  );

  const created = createFindingDecisionOutboxEntry({
    id: `  ${outboxId}  `,
    decision: decision(),
    now: "2026-07-28T12:00:00.000Z"
  });
  assert.equal(created.id, outboxId);

  const productionCreated = createFindingDecisionOutboxEntry({
    id: `  ${productionShapedId}  `,
    decision: decision(),
    now: "2026-07-28T12:00:00.000Z"
  });
  assert.equal(productionCreated.id, productionShapedId);
});

test("ASCII finding decision outbox id trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${outboxId}\u00a0`;
  // Unicode trim invents an exact match against the unpadded outbox id.
  assert.equal(nbspPadded.trim(), outboxId);
  assert.notEqual(asciiTrimFindingDecisionOutboxIdToken(nbspPadded), outboxId);
  assert.equal(canonicalizeFindingDecisionOutboxId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalFindingDecisionOutboxId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "missing_finding_decision_outbox_id"
  );
  assert.throws(
    () =>
      createFindingDecisionOutboxEntry({
        id: nbspPadded,
        decision: decision(),
        now: "2026-07-28T12:00:00.000Z"
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "missing_finding_decision_outbox_id"
  );

  const emSpacePadded = `\u2003${productionShapedId}\u2003`;
  assert.equal(emSpacePadded.trim(), productionShapedId);
  assert.equal(canonicalizeFindingDecisionOutboxId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalFindingDecisionOutboxId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "missing_finding_decision_outbox_id"
  );
  assert.throws(
    () =>
      createFindingDecisionOutboxEntry({
        id: emSpacePadded,
        decision: decision(),
        now: "2026-07-28T12:00:00.000Z"
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "missing_finding_decision_outbox_id"
  );
});

test("ASCII finding decision outbox id canonicalize rejects empty, over-long, and control-bearing ids", () => {
  assert.equal(canonicalizeFindingDecisionOutboxId(""), null);
  assert.equal(canonicalizeFindingDecisionOutboxId("   "), null);
  assert.equal(canonicalizeFindingDecisionOutboxId("a".repeat(129)), null);
  assert.equal(canonicalizeFindingDecisionOutboxId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalFindingDecisionOutboxId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "missing_finding_decision_outbox_id"
  );
  assert.throws(
    () => requireCanonicalFindingDecisionOutboxId(12),
    (error: unknown) =>
      error instanceof Error && error.message === "missing_finding_decision_outbox_id"
  );
  assert.throws(
    () =>
      createFindingDecisionOutboxEntry({
        id: "",
        decision: decision(),
        now: "2026-07-28T12:00:00.000Z"
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "missing_finding_decision_outbox_id"
  );
});

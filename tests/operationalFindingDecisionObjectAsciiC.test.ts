import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeOperationalFindingDecisionInput,
  type OperationalFindingDecisionInput
} from "../services/domain/operationalFindingDecisions";
import {
  asciiTrimOperationalFindingDecisionObjectToken,
  canonicalizeOperationalFindingDecisionObjectId,
  requireCanonicalOperationalFindingDecisionClientEventId,
  requireCanonicalOperationalFindingDecisionIdempotencyKey
} from "../services/domain/operationalFindingDecisionObjectIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/operationalFindingDecisionObjectIdentity.ts", import.meta.url),
  "utf8"
);
const decisionsSource = readFileSync(
  new URL("../services/domain/operationalFindingDecisions.ts", import.meta.url),
  "utf8"
);

const clientEventId = "device-event-1";
const idempotencyKey = "finding-decision:device-event-1";

function baseInput(
  overrides: Partial<OperationalFindingDecisionInput> = {}
): OperationalFindingDecisionInput {
  return {
    restaurantId: "restaurant-a",
    finding: {
      id: "finding:inventory:low_stock:item1",
      restaurantId: "restaurant-a",
      category: "inventory",
      severity: "warning",
      priority: "now",
      title: "Low stock",
      explanation: "Chicken is low",
      confidence: {
        score: 0.8,
        rationale: "Recent count evidence"
      },
      evidence: [
        {
          type: "inventory_item",
          id: "item-1",
          observedAt: "2026-10-11T12:00:00.000Z",
          summary: "Low stock"
        }
      ],
      affectedWorkflow: "inventory_count",
      recommendedAction: "Count chicken",
      sourceWindow: {
        start: "2026-10-11T08:00:00.000Z",
        end: "2026-10-11T12:00:00.000Z"
      },
      generatedAt: "2026-10-11T12:00:00.000Z",
      freshness: {
        state: "fresh",
        asOf: "2026-10-11T12:00:00.000Z",
        staleAfter: "2026-10-11T14:00:00.000Z",
        missingData: []
      },
      managerFeedback: {
        state: "unreviewed",
        decisionId: null,
        recordedAt: null,
        effectiveRecommendedAction: "Count chicken"
      },
      policyVersion: "beta-findings-v1"
    },
    decisionType: "approved",
    editedRecommendedAction: null,
    clientEventId,
    idempotencyKey,
    ...overrides
  };
}

test("MISE-005NH pins finding-decision object identities to ASCII C", () => {
  assert.match(identitySource, /MISE-005NH/);
  assert.match(decisionsSource, /MISE-005NH/);

  assert.match(
    identitySource,
    /export function asciiTrimOperationalFindingDecisionObjectToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    decisionsSource,
    /requireCanonicalOperationalFindingDecisionClientEventId\(input\.clientEventId\)/
  );
  assert.match(
    decisionsSource,
    /requireCanonicalOperationalFindingDecisionIdempotencyKey\(input\.idempotencyKey\)/
  );
  assert.match(
    decisionsSource,
    /from "\.\/operationalFindingDecisionObjectIdentity"/
  );

  // Leave restaurant workspace, finding.id, evidence, and free-text on Unicode trim.
  assert.match(
    decisionsSource,
    /const restaurantId = requireBoundedText\(input\.restaurantId, "Restaurant workspace", 64\);/
  );
  assert.match(decisionsSource, /id: input\.finding\.id\.trim\(\),/);
  assert.match(
    decisionsSource,
    /id: requireBoundedText\(record\.id, "Finding evidence identity", 240\)/
  );

  // Do not rewrite sibling outbox tips.
  assert.doesNotMatch(identitySource, /findingDecisionOutboxIdentity/);
  assert.doesNotMatch(identitySource, /findingDecisionOutboxKeyPrefixIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\/findingDecisionOutboxIdentity"/);
  assert.doesNotMatch(decisionsSource, /findingDecisionOutboxIdentity/);
  assert.doesNotMatch(identitySource, /inventoryLedgerObjectIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsObjectIdentity/);
});

test("ASCII trim keeps ordinary finding-decision object padding stable", () => {
  assert.equal(asciiTrimOperationalFindingDecisionObjectToken(`  ${clientEventId}  `), clientEventId);
  assert.equal(
    canonicalizeOperationalFindingDecisionObjectId(`\t${clientEventId}\n`, 200),
    clientEventId
  );
  assert.equal(
    requireCanonicalOperationalFindingDecisionClientEventId(`  ${clientEventId}  `),
    clientEventId
  );

  assert.equal(
    asciiTrimOperationalFindingDecisionObjectToken(`  ${idempotencyKey}  `),
    idempotencyKey
  );
  assert.equal(
    canonicalizeOperationalFindingDecisionObjectId(`\t${idempotencyKey}\n`, 240),
    idempotencyKey
  );
  assert.equal(
    requireCanonicalOperationalFindingDecisionIdempotencyKey(`  ${idempotencyKey}  `),
    idempotencyKey
  );

  const normalized = normalizeOperationalFindingDecisionInput(
    baseInput({
      clientEventId: `  ${clientEventId}  `,
      idempotencyKey: `  ${idempotencyKey}  `
    })
  );
  assert.equal(normalized.clientEventId, clientEventId);
  assert.equal(normalized.idempotencyKey, idempotencyKey);
});

test("NBSP and em-space padding cannot invent finding-decision object identities", () => {
  const nbspClient = `\u00a0${clientEventId}\u00a0`;
  const emClient = `\u2003${clientEventId}\u2003`;
  const nbspKey = `\u00a0${idempotencyKey}\u00a0`;
  const emKey = `\u2003${idempotencyKey}\u2003`;

  assert.equal(nbspClient.trim(), clientEventId);
  assert.equal(emClient.trim(), clientEventId);
  assert.equal(nbspKey.trim(), idempotencyKey);
  assert.equal(emKey.trim(), idempotencyKey);

  assert.equal(canonicalizeOperationalFindingDecisionObjectId(nbspClient, 200), null);
  assert.equal(canonicalizeOperationalFindingDecisionObjectId(emClient, 200), null);
  assert.equal(canonicalizeOperationalFindingDecisionObjectId(nbspKey, 240), null);
  assert.equal(canonicalizeOperationalFindingDecisionObjectId(emKey, 240), null);

  assert.throws(
    () => requireCanonicalOperationalFindingDecisionClientEventId(nbspClient),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision event identity is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingDecisionIdempotencyKey(nbspKey),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision idempotency key is invalid."
  );

  assert.throws(
    () =>
      normalizeOperationalFindingDecisionInput(
        baseInput({ clientEventId: nbspClient, idempotencyKey })
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision event identity is invalid."
  );
  assert.throws(
    () =>
      normalizeOperationalFindingDecisionInput(
        baseInput({ clientEventId, idempotencyKey: emKey })
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision idempotency key is invalid."
  );
});

test("Empty, control, over-long, and non-string finding-decision object ids fail closed", () => {
  assert.equal(canonicalizeOperationalFindingDecisionObjectId("", 200), null);
  assert.equal(canonicalizeOperationalFindingDecisionObjectId("   ", 200), null);
  assert.equal(canonicalizeOperationalFindingDecisionObjectId("a\u0000b", 200), null);
  assert.equal(canonicalizeOperationalFindingDecisionObjectId("x".repeat(201), 200), null);
  assert.equal(canonicalizeOperationalFindingDecisionObjectId("x".repeat(241), 240), null);

  assert.throws(
    () => requireCanonicalOperationalFindingDecisionClientEventId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision event identity is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingDecisionIdempotencyKey(12),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision idempotency key is invalid."
  );
});

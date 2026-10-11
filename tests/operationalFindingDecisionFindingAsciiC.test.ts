import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeOperationalFindingDecision,
  normalizeOperationalFindingDecisionInput,
  type OperationalFindingDecisionInput
} from "../services/domain/operationalFindingDecisions";
import {
  asciiTrimOperationalFindingDecisionFindingToken,
  canonicalizeOperationalFindingDecisionFindingId,
  requireCanonicalOperationalFindingDecisionFindingId
} from "../services/domain/operationalFindingDecisionFindingIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/operationalFindingDecisionFindingIdentity.ts", import.meta.url),
  "utf8"
);
const decisionsSource = readFileSync(
  new URL("../services/domain/operationalFindingDecisions.ts", import.meta.url),
  "utf8"
);

const findingId = "finding:inventory:low_stock:item1";

function baseInput(
  overrides: Partial<OperationalFindingDecisionInput> = {}
): OperationalFindingDecisionInput {
  return {
    restaurantId: "restaurant-a",
    finding: {
      id: findingId,
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
          id: "item-chicken",
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
    clientEventId: "device-event-1",
    idempotencyKey: "finding-decision:device-event-1",
    ...overrides
  };
}

function baseResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    sequence: 1,
    restaurant_id: "restaurant-a",
    finding_id: findingId,
    policy_version: "beta-findings-v1",
    decision_type: "approved",
    finding_generated_at: "2026-10-11T12:00:00.000Z",
    finding_category: "inventory",
    severity: "warning",
    confidence_score: 0.8,
    evidence: [
      {
        type: "inventory_item",
        id: "item-chicken",
        observedAt: "2026-10-11T12:00:00.000Z",
        summary: "Low stock"
      }
    ],
    original_recommended_action: "Count chicken",
    edited_recommended_action: null,
    client_event_id: "device-event-1",
    idempotency_key: "finding-decision:device-event-1",
    actor_user_id: null,
    recorded_at: "2026-10-11T12:10:00.000Z",
    ...overrides
  };
}

test("MISE-005NM pins finding-decision response finding_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005NM/);
  assert.match(decisionsSource, /MISE-005NM/);

  assert.match(
    identitySource,
    /export function asciiTrimOperationalFindingDecisionFindingToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    decisionsSource,
    /requireCanonicalOperationalFindingDecisionFindingId\(record\.finding_id\)/
  );
  assert.match(
    decisionsSource,
    /from "\.\/operationalFindingDecisionFindingIdentity"/
  );

  // Leave input finding.id on raw pattern + Unicode trim (already fail-closed).
  assert.match(decisionsSource, /if \(!findingIdPattern\.test\(input\.finding\.id\)\)/);
  assert.match(decisionsSource, /id: input\.finding\.id\.trim\(\),/);

  // Leave sibling response / evidence / object / enum fields on Unicode trim.
  assert.match(
    decisionsSource,
    /const decisionType = requireBoundedText\(record\.decision_type, "Finding decision type", 16\);/
  );
  assert.match(
    decisionsSource,
    /const type = requireBoundedText\(record\.type, "Finding evidence type", 80\);/
  );
  assert.match(
    decisionsSource,
    /id: requireBoundedText\(record\.id, "Finding evidence identity", 240\)/
  );
  assert.match(
    decisionsSource,
    /const restaurantId = requireBoundedText\(input\.restaurantId, "Restaurant workspace", 64\);/
  );
  assert.match(
    decisionsSource,
    /clientEventId: requireBoundedText\(input\.clientEventId, "Finding decision event identity", 200\)/
  );
  assert.match(
    decisionsSource,
    /idempotencyKey: requireBoundedText\(input\.idempotencyKey, "Finding decision idempotency key", 240\)/
  );
  assert.match(
    decisionsSource,
    /id: requireBoundedText\(record\.id, "Finding decision identity", 64\),/
  );
  assert.match(
    decisionsSource,
    /clientEventId: requireBoundedText\(record\.client_event_id, "Finding decision event identity", 200\),/
  );
  assert.match(
    decisionsSource,
    /idempotencyKey: requireBoundedText\(record\.idempotency_key, "Finding decision idempotency key", 240\),/
  );
  assert.match(
    decisionsSource,
    /: requireBoundedText\(record\.actor_user_id, "Finding decision actor", 64\),/
  );

  // Do not rewrite sibling tips.
  assert.doesNotMatch(identitySource, /operationalFindingDecisionObjectIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionEvidenceIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionResponseEnumIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /findingDecisionOutboxIdentity/);
  assert.doesNotMatch(identitySource, /findingDecisionOutboxKeyPrefixIdentity/);
  assert.doesNotMatch(decisionsSource, /operationalFindingDecisionObjectIdentity/);
  assert.doesNotMatch(decisionsSource, /operationalFindingDecisionResponseEnumIdentity/);
});

test("ASCII trim keeps ordinary finding-decision finding_id padding stable", () => {
  assert.equal(asciiTrimOperationalFindingDecisionFindingToken(`  ${findingId}  `), findingId);
  assert.equal(canonicalizeOperationalFindingDecisionFindingId(`\t${findingId}\n`), findingId);
  assert.equal(requireCanonicalOperationalFindingDecisionFindingId(`  ${findingId}  `), findingId);

  const response = normalizeOperationalFindingDecision(
    baseResponse({ finding_id: `  ${findingId}  ` }),
    "restaurant-a"
  );
  assert.equal(response.findingId, findingId);
});

test("NBSP and em-space padding cannot invent finding-decision response finding_id", () => {
  const nbspFinding = `\u00a0${findingId}\u00a0`;
  const emFinding = `\u2003${findingId}\u2003`;

  assert.equal(nbspFinding.trim(), findingId);
  assert.equal(emFinding.trim(), findingId);

  assert.equal(canonicalizeOperationalFindingDecisionFindingId(nbspFinding), null);
  assert.equal(canonicalizeOperationalFindingDecisionFindingId(emFinding), null);

  assert.throws(
    () => requireCanonicalOperationalFindingDecisionFindingId(nbspFinding),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding identity is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingDecisionFindingId(emFinding),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding identity is invalid."
  );

  assert.throws(
    () =>
      normalizeOperationalFindingDecision(
        baseResponse({ finding_id: nbspFinding }),
        "restaurant-a"
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding identity is invalid."
  );
  assert.throws(
    () =>
      normalizeOperationalFindingDecision(
        baseResponse({ finding_id: emFinding }),
        "restaurant-a"
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding identity is invalid."
  );
});

test("input-path finding.id NBSP padding remains fail-closed without this tip rewriting it", () => {
  const nbspFinding = `\u00a0${findingId}\u00a0`;
  assert.equal(nbspFinding.trim(), findingId);

  assert.throws(
    () =>
      normalizeOperationalFindingDecisionInput(
        baseInput({
          finding: {
            ...baseInput().finding,
            id: nbspFinding
          }
        })
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding identity is invalid."
  );
});

test("over-long, empty, control, and non-string finding_id values fail closed", () => {
  assert.equal(canonicalizeOperationalFindingDecisionFindingId(""), null);
  assert.equal(canonicalizeOperationalFindingDecisionFindingId("   "), null);
  assert.equal(
    canonicalizeOperationalFindingDecisionFindingId(`finding:${"a".repeat(240)}`),
    null
  );
  assert.equal(
    canonicalizeOperationalFindingDecisionFindingId(`finding:\u0000item`),
    null
  );

  assert.throws(
    () => requireCanonicalOperationalFindingDecisionFindingId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding identity is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingDecisionFindingId(12),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding identity is invalid."
  );
});

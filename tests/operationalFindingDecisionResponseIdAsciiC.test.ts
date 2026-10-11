import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeOperationalFindingDecision } from "../services/domain/operationalFindingDecisions";
import {
  asciiTrimOperationalFindingDecisionResponseIdToken,
  canonicalizeOperationalFindingDecisionResponseId,
  requireCanonicalOperationalFindingDecisionResponseId
} from "../services/domain/operationalFindingDecisionResponseIdIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/operationalFindingDecisionResponseIdIdentity.ts", import.meta.url),
  "utf8"
);
const decisionsSource = readFileSync(
  new URL("../services/domain/operationalFindingDecisions.ts", import.meta.url),
  "utf8"
);

const decisionId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const findingId = "finding:inventory:low_stock:item1";

function baseResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: decisionId,
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

test("MISE-005NN pins finding-decision response decision id to ASCII C", () => {
  assert.match(identitySource, /MISE-005NN/);
  assert.match(decisionsSource, /MISE-005NN/);

  assert.match(
    identitySource,
    /export function asciiTrimOperationalFindingDecisionResponseIdToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    decisionsSource,
    /id: requireCanonicalOperationalFindingDecisionResponseId\(record\.id\),/
  );
  assert.match(
    decisionsSource,
    /from "\.\/operationalFindingDecisionResponseIdIdentity"/
  );

  // Leave sibling response / evidence / object / enum / finding_id fields on Unicode trim.
  assert.match(
    decisionsSource,
    /const findingId = requireBoundedText\(record\.finding_id, "Finding identity", 240\);/
  );
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
  assert.doesNotMatch(identitySource, /operationalFindingDecisionFindingIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionObjectIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionEvidenceIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionResponseEnumIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /findingDecisionOutboxIdentity/);
  assert.doesNotMatch(identitySource, /findingDecisionOutboxKeyPrefixIdentity/);
  assert.doesNotMatch(decisionsSource, /operationalFindingDecisionFindingIdentity/);
  assert.doesNotMatch(decisionsSource, /operationalFindingDecisionObjectIdentity/);
  assert.doesNotMatch(decisionsSource, /operationalFindingDecisionResponseEnumIdentity/);
});

test("ASCII trim keeps ordinary finding-decision response id padding stable", () => {
  assert.equal(asciiTrimOperationalFindingDecisionResponseIdToken(`  ${decisionId}  `), decisionId);
  assert.equal(canonicalizeOperationalFindingDecisionResponseId(`\t${decisionId}\n`), decisionId);
  assert.equal(requireCanonicalOperationalFindingDecisionResponseId(`  ${decisionId}  `), decisionId);

  const response = normalizeOperationalFindingDecision(
    baseResponse({ id: `  ${decisionId}  ` }),
    "restaurant-a"
  );
  assert.equal(response.id, decisionId);
});

test("NBSP and em-space padding cannot invent finding-decision response decision id", () => {
  const nbspDecision = `\u00a0${decisionId}\u00a0`;
  const emDecision = `\u2003${decisionId}\u2003`;

  assert.equal(nbspDecision.trim(), decisionId);
  assert.equal(emDecision.trim(), decisionId);

  assert.equal(canonicalizeOperationalFindingDecisionResponseId(nbspDecision), null);
  assert.equal(canonicalizeOperationalFindingDecisionResponseId(emDecision), null);

  assert.throws(
    () => requireCanonicalOperationalFindingDecisionResponseId(nbspDecision),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision identity is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingDecisionResponseId(emDecision),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision identity is invalid."
  );

  assert.throws(
    () =>
      normalizeOperationalFindingDecision(
        baseResponse({ id: nbspDecision }),
        "restaurant-a"
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision identity is invalid."
  );
  assert.throws(
    () =>
      normalizeOperationalFindingDecision(
        baseResponse({ id: emDecision }),
        "restaurant-a"
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision identity is invalid."
  );
});

test("sibling response finding_id NBSP padding still invents under Unicode trim until #795 lands", () => {
  const nbspFinding = `\u00a0${findingId}\u00a0`;
  assert.equal(nbspFinding.trim(), findingId);

  const response = normalizeOperationalFindingDecision(
    baseResponse({ finding_id: nbspFinding }),
    "restaurant-a"
  );
  assert.equal(response.findingId, findingId);
});

test("over-long, empty, control, and non-string decision id values fail closed", () => {
  assert.equal(canonicalizeOperationalFindingDecisionResponseId(""), null);
  assert.equal(canonicalizeOperationalFindingDecisionResponseId("   "), null);
  assert.equal(
    canonicalizeOperationalFindingDecisionResponseId("a".repeat(65)),
    null
  );
  assert.equal(
    canonicalizeOperationalFindingDecisionResponseId("dddddddd-\u0000dd-4ddd-8ddd-dddddddddddd"),
    null
  );

  assert.throws(
    () => requireCanonicalOperationalFindingDecisionResponseId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision identity is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingDecisionResponseId(12),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision identity is invalid."
  );
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeOperationalFindingDecision } from "../services/domain/operationalFindingDecisions";
import {
  asciiTrimOperationalFindingDecisionResponseClientEventToken,
  canonicalizeOperationalFindingDecisionResponseClientEventId,
  requireCanonicalOperationalFindingDecisionResponseClientEventId
} from "../services/domain/operationalFindingDecisionResponseClientEventIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/operationalFindingDecisionResponseClientEventIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const decisionsSource = readFileSync(
  new URL("../services/domain/operationalFindingDecisions.ts", import.meta.url),
  "utf8"
);

const decisionId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const findingId = "finding:inventory:low_stock:item1";
const clientEventId = "device-event-1";

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
    client_event_id: clientEventId,
    idempotency_key: "finding-decision:device-event-1",
    actor_user_id: null,
    recorded_at: "2026-10-11T12:10:00.000Z",
    ...overrides
  };
}

test("MISE-005NO pins finding-decision response client_event_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005NO/);
  assert.match(decisionsSource, /MISE-005NO/);

  assert.match(
    identitySource,
    /export function asciiTrimOperationalFindingDecisionResponseClientEventToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    decisionsSource,
    /clientEventId: requireCanonicalOperationalFindingDecisionResponseClientEventId\(\s*record\.client_event_id\s*\)/
  );
  assert.match(
    decisionsSource,
    /from "\.\/operationalFindingDecisionResponseClientEventIdentity"/
  );

  // Leave sibling response / evidence / object / enum / decision-id fields on Unicode trim.
  assert.match(
    decisionsSource,
    /id: requireBoundedText\(record\.id, "Finding decision identity", 64\),/
  );
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
    /idempotencyKey: requireBoundedText\(record\.idempotency_key, "Finding decision idempotency key", 240\),/
  );
  assert.match(
    decisionsSource,
    /: requireBoundedText\(record\.actor_user_id, "Finding decision actor", 64\),/
  );

  // Do not rewrite sibling tips.
  assert.doesNotMatch(identitySource, /operationalFindingDecisionResponseIdIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionFindingIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionObjectIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionEvidenceIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionResponseEnumIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /findingDecisionOutboxIdentity/);
  assert.doesNotMatch(identitySource, /findingDecisionOutboxKeyPrefixIdentity/);
  assert.doesNotMatch(decisionsSource, /operationalFindingDecisionResponseIdIdentity/);
  assert.doesNotMatch(decisionsSource, /operationalFindingDecisionFindingIdentity/);
  assert.doesNotMatch(decisionsSource, /operationalFindingDecisionObjectIdentity/);
  assert.doesNotMatch(decisionsSource, /operationalFindingDecisionResponseEnumIdentity/);
});

test("ASCII trim keeps ordinary finding-decision response client_event_id padding stable", () => {
  assert.equal(
    asciiTrimOperationalFindingDecisionResponseClientEventToken(`  ${clientEventId}  `),
    clientEventId
  );
  assert.equal(
    canonicalizeOperationalFindingDecisionResponseClientEventId(`\t${clientEventId}\n`),
    clientEventId
  );
  assert.equal(
    requireCanonicalOperationalFindingDecisionResponseClientEventId(`  ${clientEventId}  `),
    clientEventId
  );

  const response = normalizeOperationalFindingDecision(
    baseResponse({ client_event_id: `  ${clientEventId}  ` }),
    "restaurant-a"
  );
  assert.equal(response.clientEventId, clientEventId);
});

test("NBSP and em-space padding cannot invent finding-decision response client_event_id", () => {
  const nbspClientEvent = `\u00a0${clientEventId}\u00a0`;
  const emClientEvent = `\u2003${clientEventId}\u2003`;

  assert.equal(nbspClientEvent.trim(), clientEventId);
  assert.equal(emClientEvent.trim(), clientEventId);

  assert.equal(
    canonicalizeOperationalFindingDecisionResponseClientEventId(nbspClientEvent),
    null
  );
  assert.equal(
    canonicalizeOperationalFindingDecisionResponseClientEventId(emClientEvent),
    null
  );

  assert.throws(
    () => requireCanonicalOperationalFindingDecisionResponseClientEventId(nbspClientEvent),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision event identity is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingDecisionResponseClientEventId(emClientEvent),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision event identity is invalid."
  );

  assert.throws(
    () =>
      normalizeOperationalFindingDecision(
        baseResponse({ client_event_id: nbspClientEvent }),
        "restaurant-a"
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision event identity is invalid."
  );
  assert.throws(
    () =>
      normalizeOperationalFindingDecision(
        baseResponse({ client_event_id: emClientEvent }),
        "restaurant-a"
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision event identity is invalid."
  );
});

test("sibling response decision id NBSP padding still invents under Unicode trim until #796 lands", () => {
  const nbspDecision = `\u00a0${decisionId}\u00a0`;
  assert.equal(nbspDecision.trim(), decisionId);

  const response = normalizeOperationalFindingDecision(
    baseResponse({ id: nbspDecision }),
    "restaurant-a"
  );
  assert.equal(response.id, decisionId);
});

test("sibling response idempotency_key NBSP padding still invents under Unicode trim until tipped", () => {
  const idempotencyKey = "finding-decision:device-event-1";
  const nbspIdempotency = `\u00a0${idempotencyKey}\u00a0`;
  assert.equal(nbspIdempotency.trim(), idempotencyKey);

  const response = normalizeOperationalFindingDecision(
    baseResponse({ idempotency_key: nbspIdempotency }),
    "restaurant-a"
  );
  assert.equal(response.idempotencyKey, idempotencyKey);
});

test("over-long, empty, control, and non-string client_event_id values fail closed", () => {
  assert.equal(canonicalizeOperationalFindingDecisionResponseClientEventId(""), null);
  assert.equal(canonicalizeOperationalFindingDecisionResponseClientEventId("   "), null);
  assert.equal(
    canonicalizeOperationalFindingDecisionResponseClientEventId("a".repeat(201)),
    null
  );
  assert.equal(
    canonicalizeOperationalFindingDecisionResponseClientEventId("device-\u0000event-1"),
    null
  );

  assert.throws(
    () => requireCanonicalOperationalFindingDecisionResponseClientEventId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision event identity is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingDecisionResponseClientEventId(12),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision event identity is invalid."
  );
});

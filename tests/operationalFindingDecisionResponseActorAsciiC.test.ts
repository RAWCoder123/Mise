import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeOperationalFindingDecision } from "../services/domain/operationalFindingDecisions";
import {
  asciiTrimOperationalFindingDecisionResponseActorToken,
  canonicalizeOperationalFindingDecisionResponseActorUserId,
  requireCanonicalOperationalFindingDecisionResponseActorUserId
} from "../services/domain/operationalFindingDecisionResponseActorIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/operationalFindingDecisionResponseActorIdentity.ts",
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
const idempotencyKey = "finding-decision:device-event-1";
const actorUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

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
    idempotency_key: idempotencyKey,
    actor_user_id: actorUserId,
    recorded_at: "2026-10-11T12:10:00.000Z",
    ...overrides
  };
}

test("MISE-005NQ pins finding-decision response actor_user_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005NQ/);
  assert.match(decisionsSource, /MISE-005NQ/);

  assert.match(
    identitySource,
    /export function asciiTrimOperationalFindingDecisionResponseActorToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    decisionsSource,
    /requireCanonicalOperationalFindingDecisionResponseActorUserId\(\s*record\.actor_user_id\s*\)/
  );
  assert.match(
    decisionsSource,
    /from "\.\/operationalFindingDecisionResponseActorIdentity"/
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
    /clientEventId: requireBoundedText\(record\.client_event_id, "Finding decision event identity", 200\),/
  );
  assert.match(
    decisionsSource,
    /idempotencyKey: requireBoundedText\(record\.idempotency_key, "Finding decision idempotency key", 240\),/
  );

  // Do not rewrite sibling tips.
  assert.doesNotMatch(identitySource, /operationalFindingDecisionResponseIdIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionFindingIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionObjectIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionEvidenceIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionResponseEnumIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionResponseClientEventIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionResponseIdempotencyIdentity/);
  assert.doesNotMatch(identitySource, /findingDecisionOutboxIdentity/);
  assert.doesNotMatch(identitySource, /findingDecisionOutboxKeyPrefixIdentity/);
  assert.doesNotMatch(decisionsSource, /operationalFindingDecisionResponseIdIdentity/);
  assert.doesNotMatch(decisionsSource, /operationalFindingDecisionFindingIdentity/);
  assert.doesNotMatch(decisionsSource, /operationalFindingDecisionObjectIdentity/);
  assert.doesNotMatch(decisionsSource, /operationalFindingDecisionResponseEnumIdentity/);
  assert.doesNotMatch(decisionsSource, /operationalFindingDecisionResponseClientEventIdentity/);
  assert.doesNotMatch(decisionsSource, /operationalFindingDecisionResponseIdempotencyIdentity/);
});

test("ASCII trim keeps ordinary finding-decision response actor_user_id padding stable", () => {
  assert.equal(
    asciiTrimOperationalFindingDecisionResponseActorToken(`  ${actorUserId}  `),
    actorUserId
  );
  assert.equal(
    canonicalizeOperationalFindingDecisionResponseActorUserId(`\t${actorUserId}\n`),
    actorUserId
  );
  assert.equal(
    requireCanonicalOperationalFindingDecisionResponseActorUserId(`  ${actorUserId}  `),
    actorUserId
  );

  const response = normalizeOperationalFindingDecision(
    baseResponse({ actor_user_id: `  ${actorUserId}  ` }),
    "restaurant-a"
  );
  assert.equal(response.actorUserId, actorUserId);
});

test("null finding-decision response actor_user_id remains allowed", () => {
  const response = normalizeOperationalFindingDecision(
    baseResponse({ actor_user_id: null }),
    "restaurant-a"
  );
  assert.equal(response.actorUserId, null);
});

test("NBSP and em-space padding cannot invent finding-decision response actor_user_id", () => {
  const nbspActor = `\u00a0${actorUserId}\u00a0`;
  const emActor = `\u2003${actorUserId}\u2003`;

  assert.equal(nbspActor.trim(), actorUserId);
  assert.equal(emActor.trim(), actorUserId);

  assert.equal(
    canonicalizeOperationalFindingDecisionResponseActorUserId(nbspActor),
    null
  );
  assert.equal(
    canonicalizeOperationalFindingDecisionResponseActorUserId(emActor),
    null
  );

  assert.throws(
    () => requireCanonicalOperationalFindingDecisionResponseActorUserId(nbspActor),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision actor is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingDecisionResponseActorUserId(emActor),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision actor is invalid."
  );

  assert.throws(
    () =>
      normalizeOperationalFindingDecision(
        baseResponse({ actor_user_id: nbspActor }),
        "restaurant-a"
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision actor is invalid."
  );
  assert.throws(
    () =>
      normalizeOperationalFindingDecision(
        baseResponse({ actor_user_id: emActor }),
        "restaurant-a"
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision actor is invalid."
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

test("sibling response client_event_id NBSP padding still invents under Unicode trim until #797 lands", () => {
  const nbspClientEvent = `\u00a0${clientEventId}\u00a0`;
  assert.equal(nbspClientEvent.trim(), clientEventId);

  const response = normalizeOperationalFindingDecision(
    baseResponse({ client_event_id: nbspClientEvent }),
    "restaurant-a"
  );
  assert.equal(response.clientEventId, clientEventId);
});

test("sibling response idempotency_key NBSP padding still invents under Unicode trim until #798 lands", () => {
  const nbspIdempotency = `\u00a0${idempotencyKey}\u00a0`;
  assert.equal(nbspIdempotency.trim(), idempotencyKey);

  const response = normalizeOperationalFindingDecision(
    baseResponse({ idempotency_key: nbspIdempotency }),
    "restaurant-a"
  );
  assert.equal(response.idempotencyKey, idempotencyKey);
});

test("over-long, empty, control, and non-string actor_user_id values fail closed", () => {
  assert.equal(canonicalizeOperationalFindingDecisionResponseActorUserId(""), null);
  assert.equal(canonicalizeOperationalFindingDecisionResponseActorUserId("   "), null);
  assert.equal(
    canonicalizeOperationalFindingDecisionResponseActorUserId("a".repeat(65)),
    null
  );
  assert.equal(
    canonicalizeOperationalFindingDecisionResponseActorUserId("actor-\u0000user"),
    null
  );

  assert.throws(
    () => requireCanonicalOperationalFindingDecisionResponseActorUserId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision actor is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingDecisionResponseActorUserId(12),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision actor is invalid."
  );
});

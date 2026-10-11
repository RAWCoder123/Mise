import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeOperationalFindingDecision } from "../services/domain/operationalFindingDecisions";
import {
  asciiTrimOperationalFindingDecisionResponseIdempotencyToken,
  canonicalizeOperationalFindingDecisionResponseIdempotencyKey,
  requireCanonicalOperationalFindingDecisionResponseIdempotencyKey
} from "../services/domain/operationalFindingDecisionResponseIdempotencyIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/operationalFindingDecisionResponseIdempotencyIdentity.ts",
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
    actor_user_id: null,
    recorded_at: "2026-10-11T12:10:00.000Z",
    ...overrides
  };
}

test("MISE-005NP pins finding-decision response idempotency_key to ASCII C", () => {
  assert.match(identitySource, /MISE-005NP/);
  assert.match(decisionsSource, /MISE-005NP/);

  assert.match(
    identitySource,
    /export function asciiTrimOperationalFindingDecisionResponseIdempotencyToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    decisionsSource,
    /idempotencyKey: requireCanonicalOperationalFindingDecisionResponseIdempotencyKey\(\s*record\.idempotency_key\s*\)/
  );
  assert.match(
    decisionsSource,
    /from "\.\/operationalFindingDecisionResponseIdempotencyIdentity"/
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
    /: requireBoundedText\(record\.actor_user_id, "Finding decision actor", 64\),/
  );

  // Do not rewrite sibling tips.
  assert.doesNotMatch(identitySource, /operationalFindingDecisionResponseIdIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionFindingIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionObjectIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionEvidenceIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionResponseEnumIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionResponseClientEventIdentity/);
  assert.doesNotMatch(identitySource, /findingDecisionOutboxIdentity/);
  assert.doesNotMatch(identitySource, /findingDecisionOutboxKeyPrefixIdentity/);
  assert.doesNotMatch(decisionsSource, /operationalFindingDecisionResponseIdIdentity/);
  assert.doesNotMatch(decisionsSource, /operationalFindingDecisionFindingIdentity/);
  assert.doesNotMatch(decisionsSource, /operationalFindingDecisionObjectIdentity/);
  assert.doesNotMatch(decisionsSource, /operationalFindingDecisionResponseEnumIdentity/);
  assert.doesNotMatch(decisionsSource, /operationalFindingDecisionResponseClientEventIdentity/);
});

test("ASCII trim keeps ordinary finding-decision response idempotency_key padding stable", () => {
  assert.equal(
    asciiTrimOperationalFindingDecisionResponseIdempotencyToken(`  ${idempotencyKey}  `),
    idempotencyKey
  );
  assert.equal(
    canonicalizeOperationalFindingDecisionResponseIdempotencyKey(`\t${idempotencyKey}\n`),
    idempotencyKey
  );
  assert.equal(
    requireCanonicalOperationalFindingDecisionResponseIdempotencyKey(`  ${idempotencyKey}  `),
    idempotencyKey
  );

  const response = normalizeOperationalFindingDecision(
    baseResponse({ idempotency_key: `  ${idempotencyKey}  ` }),
    "restaurant-a"
  );
  assert.equal(response.idempotencyKey, idempotencyKey);
});

test("NBSP and em-space padding cannot invent finding-decision response idempotency_key", () => {
  const nbspIdempotency = `\u00a0${idempotencyKey}\u00a0`;
  const emIdempotency = `\u2003${idempotencyKey}\u2003`;

  assert.equal(nbspIdempotency.trim(), idempotencyKey);
  assert.equal(emIdempotency.trim(), idempotencyKey);

  assert.equal(
    canonicalizeOperationalFindingDecisionResponseIdempotencyKey(nbspIdempotency),
    null
  );
  assert.equal(
    canonicalizeOperationalFindingDecisionResponseIdempotencyKey(emIdempotency),
    null
  );

  assert.throws(
    () => requireCanonicalOperationalFindingDecisionResponseIdempotencyKey(nbspIdempotency),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision idempotency key is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingDecisionResponseIdempotencyKey(emIdempotency),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision idempotency key is invalid."
  );

  assert.throws(
    () =>
      normalizeOperationalFindingDecision(
        baseResponse({ idempotency_key: nbspIdempotency }),
        "restaurant-a"
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision idempotency key is invalid."
  );
  assert.throws(
    () =>
      normalizeOperationalFindingDecision(
        baseResponse({ idempotency_key: emIdempotency }),
        "restaurant-a"
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision idempotency key is invalid."
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

test("sibling response actor_user_id NBSP padding still invents under Unicode trim until tipped", () => {
  const actorUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const nbspActor = `\u00a0${actorUserId}\u00a0`;
  assert.equal(nbspActor.trim(), actorUserId);

  const response = normalizeOperationalFindingDecision(
    baseResponse({ actor_user_id: nbspActor }),
    "restaurant-a"
  );
  assert.equal(response.actorUserId, actorUserId);
});

test("over-long, empty, control, and non-string idempotency_key values fail closed", () => {
  assert.equal(canonicalizeOperationalFindingDecisionResponseIdempotencyKey(""), null);
  assert.equal(canonicalizeOperationalFindingDecisionResponseIdempotencyKey("   "), null);
  assert.equal(
    canonicalizeOperationalFindingDecisionResponseIdempotencyKey("a".repeat(241)),
    null
  );
  assert.equal(
    canonicalizeOperationalFindingDecisionResponseIdempotencyKey("finding-\u0000decision"),
    null
  );

  assert.throws(
    () => requireCanonicalOperationalFindingDecisionResponseIdempotencyKey(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision idempotency key is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingDecisionResponseIdempotencyKey(12),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision idempotency key is invalid."
  );
});

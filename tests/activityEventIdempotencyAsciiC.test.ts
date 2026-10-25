import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ACTIVITY_EVENT_IDEMPOTENCY_KEY_MAX_CHARACTERS,
  asciiTrimActivityEventIdempotencyKey,
  canonicalizeActivityEventIdempotencyKey,
  normalizeActivityEventIdempotencyKey
} from "../services/domain/activityEventIdempotencyIdentity";
import {
  activityIdempotencyKey,
  dedupeActivityEvents,
  type ActivityEvent
} from "../services/domain/activityEvents";

const identitySource = readFileSync(
  new URL("../services/domain/activityEventIdempotencyIdentity.ts", import.meta.url),
  "utf8"
);
const activitySource = readFileSync(
  new URL("../services/domain/activityEvents.ts", import.meta.url),
  "utf8"
);

const idempotencyKey = "recommendation_created:rec-1";

function baseEvent(
  overrides: Partial<ActivityEvent> & { metadata?: ActivityEvent["metadata"] } = {}
): Pick<
  ActivityEvent,
  "activityType" | "relatedEntityType" | "relatedEntityId" | "occurredAt" | "metadata"
> {
  const { metadata: metadataOverride, ...rest } = overrides;
  return {
    activityType: "recommendation_created",
    relatedEntityType: "purchase_recommendation",
    relatedEntityId: "rec-1",
    occurredAt: "2026-10-25T22:00:00.000Z",
    metadata: {
      idempotencyKey,
      ...(metadataOverride ?? {})
    },
    ...rest
  };
}

test("MISE-005QH pins activity-event idempotency keys to ASCII C", () => {
  assert.match(identitySource, /MISE-005QH/);
  assert.match(activitySource, /MISE-005QH/);

  assert.match(
    identitySource,
    /export function asciiTrimActivityEventIdempotencyKey\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    activitySource,
    /normalizeActivityEventIdempotencyKey\(event\.metadata\.idempotencyKey\)/
  );
  assert.match(activitySource, /from "\.\/activityEventIdempotencyIdentity"/);

  // Leave restaurant scope Unicode trim on its existing contract.
  assert.match(
    activitySource,
    /function requireRestaurantId\(restaurantId: string\) \{\s*const normalized = restaurantId\.trim\(\);/
  );

  // Do not rewrite sibling finding-decision / mise-actions / SQL tips.
  assert.doesNotMatch(identitySource, /operationalFindingDecisionObjectIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsObjectIdentity/);
  assert.doesNotMatch(activitySource, /operationalFindingDecisionObjectIdentity/);
  assert.doesNotMatch(identitySource, /findingDecisionOutboxIdentity/);
  assert.equal(ACTIVITY_EVENT_IDEMPOTENCY_KEY_MAX_CHARACTERS, 240);
});

test("ASCII trim keeps ordinary activity idempotency padding stable", () => {
  assert.equal(asciiTrimActivityEventIdempotencyKey(`  ${idempotencyKey}  `), idempotencyKey);
  assert.equal(
    canonicalizeActivityEventIdempotencyKey(`\t${idempotencyKey}\n`),
    idempotencyKey
  );
  assert.equal(
    normalizeActivityEventIdempotencyKey(`  ${idempotencyKey}  `),
    idempotencyKey
  );

  assert.equal(
    activityIdempotencyKey(
      baseEvent({
        metadata: { idempotencyKey: `  ${idempotencyKey}  ` }
      })
    ),
    idempotencyKey
  );
});

test("NBSP and em-space padding cannot invent activity idempotency keys", () => {
  const nbspKey = `\u00a0${idempotencyKey}\u00a0`;
  const emKey = `\u2003${idempotencyKey}\u2003`;

  assert.equal(nbspKey.trim(), idempotencyKey);
  assert.equal(emKey.trim(), idempotencyKey);

  assert.equal(canonicalizeActivityEventIdempotencyKey(nbspKey), null);
  assert.equal(canonicalizeActivityEventIdempotencyKey(emKey), null);
  assert.equal(normalizeActivityEventIdempotencyKey(nbspKey), null);
  assert.equal(normalizeActivityEventIdempotencyKey(emKey), null);

  const synthetic = [
    "recommendation_created",
    "purchase_recommendation",
    "rec-1",
    "2026-10-25T22:00"
  ].join(":");

  assert.equal(
    activityIdempotencyKey(baseEvent({ metadata: { idempotencyKey: nbspKey } })),
    synthetic
  );
  assert.equal(
    activityIdempotencyKey(baseEvent({ metadata: { idempotencyKey: emKey } })),
    synthetic
  );

  // Soft empty Unicode-only padding falls through like prior `.trim()` emptiness.
  assert.equal(normalizeActivityEventIdempotencyKey("\u2003\u2003"), null);
  assert.equal(
    activityIdempotencyKey(baseEvent({ metadata: { idempotencyKey: "\u2003\u2003" } })),
    synthetic
  );

  // Padded explicit key must not invent equality with a clean explicit key.
  const clean = {
    ...baseEvent(),
    restaurantId: "restaurant-a",
    id: "activity-clean",
    locationId: null,
    createdAt: "2026-10-25T22:00:00.000Z",
    category: "orders" as const,
    title: "Clean",
    summary: "Clean",
    triggerType: "system",
    triggerReference: null,
    evidenceReferences: [],
    sourceSystems: ["mise"],
    actionId: null,
    recommendationId: null,
    autonomyLevel: 2 as const,
    confidence: null,
    status: "completed" as const,
    requiresAttention: false,
    attentionDeadline: null,
    parentActivityId: null,
    sequenceId: null,
    errorCode: null,
    errorMessage: null,
    resolvedAt: null,
    resolvedBy: null
  } satisfies ActivityEvent;

  const padded = {
    ...clean,
    id: "activity-padded",
    metadata: { idempotencyKey: emKey }
  } satisfies ActivityEvent;

  const deduped = dedupeActivityEvents([clean, padded]);
  assert.equal(deduped.length, 2);
  assert.equal(activityIdempotencyKey(clean), idempotencyKey);
  assert.equal(activityIdempotencyKey(padded), synthetic);
});

test("control characters and over-long keys soft-fallthrough without inventing", () => {
  const withControl = `${idempotencyKey}\u0001`;
  assert.equal(canonicalizeActivityEventIdempotencyKey(withControl), null);
  assert.equal(normalizeActivityEventIdempotencyKey(withControl), null);

  const tooLong = `${"a".repeat(241)}`;
  assert.equal(tooLong.length, 241);
  assert.equal(canonicalizeActivityEventIdempotencyKey(tooLong), null);
  assert.equal(normalizeActivityEventIdempotencyKey(tooLong), null);

  assert.equal(normalizeActivityEventIdempotencyKey(null), null);
  assert.equal(normalizeActivityEventIdempotencyKey(12), null);
  assert.equal(normalizeActivityEventIdempotencyKey(""), null);
});

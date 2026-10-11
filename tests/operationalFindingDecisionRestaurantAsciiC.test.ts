import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeOperationalFindingDecisionInput,
  type OperationalFindingDecisionInput
} from "../services/domain/operationalFindingDecisions";
import {
  asciiTrimOperationalFindingDecisionRestaurantToken,
  canonicalizeOperationalFindingDecisionRestaurantId,
  requireCanonicalOperationalFindingDecisionRestaurantId
} from "../services/domain/operationalFindingDecisionRestaurantIdentity";
import type { OperationalFinding } from "../services/domain/operationalFindings";

const identitySource = readFileSync(
  new URL("../services/domain/operationalFindingDecisionRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const decisionsSource = readFileSync(
  new URL("../services/domain/operationalFindingDecisions.ts", import.meta.url),
  "utf8"
);
const objectIdentityPath = new URL(
  "../services/domain/operationalFindingDecisionObjectIdentity.ts",
  import.meta.url
);
const applicationFindingDecisionsSource = readFileSync(
  new URL("../services/application/findingDecisions.ts", import.meta.url),
  "utf8"
);

const restaurantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const demoRestaurantId = "restaurant-a";

function findingFor(workspace: string): OperationalFinding {
  return {
    id: "finding:inventory:low_stock:item1",
    restaurantId: workspace,
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
  };
}

function baseInput(
  overrides: Partial<OperationalFindingDecisionInput> = {}
): OperationalFindingDecisionInput {
  return {
    restaurantId,
    finding: findingFor(restaurantId),
    decisionType: "approved",
    editedRecommendedAction: null,
    clientEventId: "device-event-1",
    idempotencyKey: "finding-decision:device-event-1",
    ...overrides
  };
}

test("MISE-005NI pins finding-decision restaurant workspace to ASCII C", () => {
  assert.match(identitySource, /MISE-005NI/);
  assert.match(decisionsSource, /MISE-005NI/);

  assert.match(
    identitySource,
    /export function asciiTrimOperationalFindingDecisionRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    decisionsSource,
    /requireCanonicalOperationalFindingDecisionRestaurantId\(\s*input\.restaurantId\s*\)/
  );
  assert.match(
    decisionsSource,
    /from "\.\/operationalFindingDecisionRestaurantIdentity"/
  );

  // Leave object identities, finding.id, evidence, and free-text on Unicode trim.
  assert.match(
    decisionsSource,
    /clientEventId: requireBoundedText\(input\.clientEventId, "Finding decision event identity", 200\)/
  );
  assert.match(
    decisionsSource,
    /idempotencyKey: requireBoundedText\(input\.idempotencyKey, "Finding decision idempotency key", 240\)/
  );
  assert.match(decisionsSource, /id: input\.finding\.id\.trim\(\),/);
  assert.match(
    decisionsSource,
    /id: requireBoundedText\(record\.id, "Finding evidence identity", 240\)/
  );
  assert.match(
    decisionsSource,
    /requireBoundedText\(\s*input\.finding\.recommendedAction,\s*"Finding recommended action",\s*320\s*\)/
  );

  // Do not rewrite sibling object-identity or application restaurant tips.
  assert.doesNotMatch(identitySource, /operationalFindingDecisionObjectIdentity/);
  assert.doesNotMatch(identitySource, /findingDecisionOutboxIdentity/);
  assert.doesNotMatch(identitySource, /findingDecisionsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingsRestaurantIdentity/);
  assert.doesNotMatch(decisionsSource, /operationalFindingDecisionObjectIdentity/);
  assert.doesNotMatch(
    identitySource,
    /export function (?:asciiTrim|canonicalize|requireCanonical)OperationalFindingDecision(?:ClientEvent|Idempotency)/
  );

  // Application finding-decisions restaurant tip (#749) stays on its own module.
  assert.doesNotMatch(
    applicationFindingDecisionsSource,
    /operationalFindingDecisionRestaurantIdentity/
  );

  // Object-identity helper from open tip #790 is intentionally absent on this tip branch.
  try {
    readFileSync(objectIdentityPath, "utf8");
    assert.fail("object identity helper should not exist on this tip branch yet");
  } catch (error) {
    assert.ok(error instanceof Error && "code" in error && error.code === "ENOENT");
  }
});

test("ASCII trim keeps ordinary finding-decision restaurant padding stable", () => {
  assert.equal(
    asciiTrimOperationalFindingDecisionRestaurantToken(`  ${restaurantId}  `),
    restaurantId
  );
  assert.equal(
    canonicalizeOperationalFindingDecisionRestaurantId(`\t${restaurantId}\n`),
    restaurantId
  );
  assert.equal(
    requireCanonicalOperationalFindingDecisionRestaurantId(` ${restaurantId} `),
    restaurantId
  );

  assert.equal(
    asciiTrimOperationalFindingDecisionRestaurantToken(`  ${demoRestaurantId}  `),
    demoRestaurantId
  );
  assert.equal(
    canonicalizeOperationalFindingDecisionRestaurantId(`\t${demoRestaurantId}\n`),
    demoRestaurantId
  );
  assert.equal(
    requireCanonicalOperationalFindingDecisionRestaurantId(` ${demoRestaurantId} `),
    demoRestaurantId
  );

  const normalized = normalizeOperationalFindingDecisionInput(
    baseInput({
      restaurantId: `  ${restaurantId}  `,
      finding: findingFor(restaurantId)
    })
  );
  assert.equal(normalized.restaurantId, restaurantId);

  const demoNormalized = normalizeOperationalFindingDecisionInput(
    baseInput({
      restaurantId: `  ${demoRestaurantId}  `,
      finding: findingFor(demoRestaurantId)
    })
  );
  assert.equal(demoNormalized.restaurantId, demoRestaurantId);
});

test("NBSP and em-space padding cannot invent finding-decision restaurant workspace", () => {
  const nbspPadded = `\u00a0${restaurantId}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), restaurantId);
  assert.notEqual(asciiTrimOperationalFindingDecisionRestaurantToken(nbspPadded), restaurantId);
  assert.equal(canonicalizeOperationalFindingDecisionRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalOperationalFindingDecisionRestaurantId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Restaurant workspace is invalid."
  );
  assert.throws(
    () =>
      normalizeOperationalFindingDecisionInput(
        baseInput({
          restaurantId: nbspPadded,
          finding: findingFor(restaurantId)
        })
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Restaurant workspace is invalid."
  );

  const emSpacePadded = `\u2003${restaurantId}\u2003`;
  assert.equal(emSpacePadded.trim(), restaurantId);
  assert.equal(canonicalizeOperationalFindingDecisionRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalOperationalFindingDecisionRestaurantId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Restaurant workspace is invalid."
  );
  assert.throws(
    () =>
      normalizeOperationalFindingDecisionInput(
        baseInput({
          restaurantId: emSpacePadded,
          finding: findingFor(restaurantId)
        })
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Restaurant workspace is invalid."
  );

  const nbspPaddedDemo = `\u00a0${demoRestaurantId}\u00a0`;
  assert.equal(nbspPaddedDemo.trim(), demoRestaurantId);
  assert.equal(canonicalizeOperationalFindingDecisionRestaurantId(nbspPaddedDemo), null);
  assert.throws(
    () =>
      normalizeOperationalFindingDecisionInput(
        baseInput({
          restaurantId: nbspPaddedDemo,
          finding: findingFor(demoRestaurantId)
        })
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Restaurant workspace is invalid."
  );
});

test("Finding-decision restaurant workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeOperationalFindingDecisionRestaurantId(""), null);
  assert.equal(canonicalizeOperationalFindingDecisionRestaurantId("   "), null);
  assert.equal(canonicalizeOperationalFindingDecisionRestaurantId("a".repeat(65)), null);
  assert.equal(canonicalizeOperationalFindingDecisionRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalOperationalFindingDecisionRestaurantId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Restaurant workspace is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingDecisionRestaurantId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Restaurant workspace is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingDecisionRestaurantId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Restaurant workspace is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingDecisionRestaurantId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Restaurant workspace is invalid."
  );
  assert.throws(
    () => normalizeOperationalFindingDecisionInput(baseInput({ restaurantId: "" })),
    (error: unknown) =>
      error instanceof Error && error.message === "Restaurant workspace is invalid."
  );
});

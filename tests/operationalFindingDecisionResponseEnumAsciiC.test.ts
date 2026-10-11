import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeOperationalFindingDecision,
  normalizeOperationalFindingDecisionInput,
  type OperationalFindingDecisionInput
} from "../services/domain/operationalFindingDecisions";
import {
  asciiTrimOperationalFindingDecisionResponseEnumToken,
  canonicalizeOperationalFindingDecisionResponseEnumToken,
  requireCanonicalOperationalFindingCategory,
  requireCanonicalOperationalFindingDecisionType,
  requireCanonicalOperationalFindingSeverity
} from "../services/domain/operationalFindingDecisionResponseEnumIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/operationalFindingDecisionResponseEnumIdentity.ts", import.meta.url),
  "utf8"
);
const decisionsSource = readFileSync(
  new URL("../services/domain/operationalFindingDecisions.ts", import.meta.url),
  "utf8"
);

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
    finding_id: "finding:inventory:low_stock:item1",
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

test("MISE-005NL pins finding-decision response enum tokens to ASCII C", () => {
  assert.match(identitySource, /MISE-005NL/);
  assert.match(decisionsSource, /MISE-005NL/);

  assert.match(
    identitySource,
    /export function asciiTrimOperationalFindingDecisionResponseEnumToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    decisionsSource,
    /requireCanonicalOperationalFindingDecisionType\(record\.decision_type\)/
  );
  assert.match(
    decisionsSource,
    /requireCanonicalOperationalFindingCategory\(record\.finding_category\)/
  );
  assert.match(
    decisionsSource,
    /requireCanonicalOperationalFindingSeverity\(record\.severity\)/
  );
  assert.match(
    decisionsSource,
    /from "\.\/operationalFindingDecisionResponseEnumIdentity"/
  );

  // Leave evidence type, evidence id/summary, restaurant, finding.id, and
  // object / response identity fields on Unicode trim for sibling tips.
  assert.match(
    decisionsSource,
    /const type = requireBoundedText\(record\.type, "Finding evidence type", 80\);/
  );
  assert.match(
    decisionsSource,
    /const restaurantId = requireBoundedText\(input\.restaurantId, "Restaurant workspace", 64\);/
  );
  assert.match(decisionsSource, /id: input\.finding\.id\.trim\(\),/);
  assert.match(
    decisionsSource,
    /id: requireBoundedText\(record\.id, "Finding evidence identity", 240\)/
  );
  assert.match(
    decisionsSource,
    /summary: requireBoundedText\(record\.summary, "Finding evidence summary", 240\)/
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
    /const findingId = requireBoundedText\(record\.finding_id, "Finding identity", 240\);/
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

  // Input path still uses raw Set.has without Unicode trim inventing.
  assert.match(
    decisionsSource,
    /if \(!decisionTypes\.has\(input\.decisionType\)\) throw new Error\("Finding decision type is invalid\."\);/
  );
  assert.match(
    decisionsSource,
    /if \(!findingCategories\.has\(input\.finding\.category\)\) throw new Error\("Finding category is invalid\."\);/
  );
  assert.match(
    decisionsSource,
    /if \(!severities\.has\(input\.finding\.severity\)\) throw new Error\("Finding severity is invalid\."\);/
  );

  // Do not rewrite sibling tips.
  assert.doesNotMatch(identitySource, /operationalFindingDecisionEvidenceTypeIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionEvidenceIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionObjectIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /findingDecisionOutboxIdentity/);
  assert.doesNotMatch(identitySource, /findingDecisionOutboxKeyPrefixIdentity/);
  assert.doesNotMatch(decisionsSource, /operationalFindingDecisionEvidenceTypeIdentity/);
  assert.doesNotMatch(decisionsSource, /operationalFindingDecisionEvidenceIdentity/);
  assert.doesNotMatch(decisionsSource, /operationalFindingDecisionObjectIdentity/);
  assert.doesNotMatch(decisionsSource, /operationalFindingDecisionRestaurantIdentity/);
});

test("ASCII trim keeps ordinary finding-decision response enum padding stable", () => {
  assert.equal(
    asciiTrimOperationalFindingDecisionResponseEnumToken("  approved  "),
    "approved"
  );
  assert.equal(
    canonicalizeOperationalFindingDecisionResponseEnumToken("\tapproved\n", 16),
    "approved"
  );
  assert.equal(requireCanonicalOperationalFindingDecisionType("  approved  "), "approved");
  assert.equal(requireCanonicalOperationalFindingCategory("  inventory  "), "inventory");
  assert.equal(requireCanonicalOperationalFindingSeverity("  warning  "), "warning");

  const response = normalizeOperationalFindingDecision(
    baseResponse({
      decision_type: "  approved  ",
      finding_category: "  inventory  ",
      severity: "  warning  "
    }),
    "restaurant-a"
  );
  assert.equal(response.decisionType, "approved");
  assert.equal(response.findingCategory, "inventory");
  assert.equal(response.severity, "warning");
});

test("Unicode end padding does not invent finding-decision response enum tokens", () => {
  const nbspDecision = "\u00a0approved\u00a0";
  const emDecision = "\u2003approved\u2003";
  const nbspCategory = "\u00a0inventory\u00a0";
  const emCategory = "\u2003inventory\u2003";
  const nbspSeverity = "\u00a0warning\u00a0";
  const emSeverity = "\u2003warning\u2003";

  assert.equal(nbspDecision.trim(), "approved");
  assert.equal(emDecision.trim(), "approved");
  assert.equal(nbspCategory.trim(), "inventory");
  assert.equal(emCategory.trim(), "inventory");
  assert.equal(nbspSeverity.trim(), "warning");
  assert.equal(emSeverity.trim(), "warning");

  assert.equal(
    canonicalizeOperationalFindingDecisionResponseEnumToken(nbspDecision, 16),
    null
  );
  assert.equal(
    canonicalizeOperationalFindingDecisionResponseEnumToken(emDecision, 16),
    null
  );
  assert.equal(
    canonicalizeOperationalFindingDecisionResponseEnumToken(nbspCategory, 32),
    null
  );
  assert.equal(
    canonicalizeOperationalFindingDecisionResponseEnumToken(emSeverity, 16),
    null
  );

  assert.throws(
    () => requireCanonicalOperationalFindingDecisionType(nbspDecision),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision type is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingDecisionType(emDecision),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision type is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingCategory(nbspCategory),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding category is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingCategory(emCategory),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding category is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingSeverity(nbspSeverity),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding severity is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingSeverity(emSeverity),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding severity is invalid."
  );

  assert.throws(
    () =>
      normalizeOperationalFindingDecision(
        baseResponse({ decision_type: nbspDecision }),
        "restaurant-a"
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision type is invalid."
  );
  assert.throws(
    () =>
      normalizeOperationalFindingDecision(
        baseResponse({ finding_category: nbspCategory }),
        "restaurant-a"
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding category is invalid."
  );
  assert.throws(
    () =>
      normalizeOperationalFindingDecision(
        baseResponse({ severity: emSeverity }),
        "restaurant-a"
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding severity is invalid."
  );
});

test("Empty, control, over-long, unknown, and non-string response enums fail closed", () => {
  assert.equal(canonicalizeOperationalFindingDecisionResponseEnumToken("", 16), null);
  assert.equal(canonicalizeOperationalFindingDecisionResponseEnumToken("   ", 16), null);
  assert.equal(canonicalizeOperationalFindingDecisionResponseEnumToken("a\u0000b", 16), null);
  assert.equal(
    canonicalizeOperationalFindingDecisionResponseEnumToken("x".repeat(17), 16),
    null
  );
  assert.equal(
    canonicalizeOperationalFindingDecisionResponseEnumToken("x".repeat(33), 32),
    null
  );

  assert.throws(
    () => requireCanonicalOperationalFindingDecisionType(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision type is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingCategory(12),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding category is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingSeverity({}),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding severity is invalid."
  );

  assert.throws(
    () =>
      normalizeOperationalFindingDecision(
        baseResponse({ decision_type: "not_a_real_decision" }),
        "restaurant-a"
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision type is invalid."
  );
  assert.throws(
    () =>
      normalizeOperationalFindingDecision(
        baseResponse({ finding_category: "not_a_real_category" }),
        "restaurant-a"
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding category is invalid."
  );
  assert.throws(
    () =>
      normalizeOperationalFindingDecision(
        baseResponse({ severity: "not_a_real_severity" }),
        "restaurant-a"
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding severity is invalid."
  );
});

test("Input-path enum membership fail-closes Unicode padding without inventing", () => {
  // Proven non-inventing on the input path: Set.has tests the raw enum token
  // without Unicode trim, so NBSP/em-space padding never invents membership.
  const paddedDecision = "\u00a0approved\u00a0";
  const paddedCategory = "\u00a0inventory\u00a0";
  const paddedSeverity = "\u2003warning\u2003";

  assert.equal(paddedDecision.trim(), "approved");
  assert.equal(paddedCategory.trim(), "inventory");
  assert.equal(paddedSeverity.trim(), "warning");

  assert.throws(
    () =>
      normalizeOperationalFindingDecisionInput(
        baseInput({
          decisionType: paddedDecision as OperationalFindingDecisionInput["decisionType"]
        })
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding decision type is invalid."
  );
  assert.throws(
    () =>
      normalizeOperationalFindingDecisionInput(
        baseInput({
          finding: {
            ...baseInput().finding,
            category: paddedCategory as OperationalFindingDecisionInput["finding"]["category"]
          }
        })
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding category is invalid."
  );
  assert.throws(
    () =>
      normalizeOperationalFindingDecisionInput(
        baseInput({
          finding: {
            ...baseInput().finding,
            severity: paddedSeverity as OperationalFindingDecisionInput["finding"]["severity"]
          }
        })
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding severity is invalid."
  );
});

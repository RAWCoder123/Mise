import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeOperationalFindingDecision,
  normalizeOperationalFindingDecisionInput,
  type OperationalFindingDecisionInput
} from "../services/domain/operationalFindingDecisions";
import {
  asciiTrimOperationalFindingDecisionEvidenceTypeToken,
  canonicalizeOperationalFindingDecisionEvidenceType,
  requireCanonicalOperationalFindingDecisionEvidenceType
} from "../services/domain/operationalFindingDecisionEvidenceTypeIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/operationalFindingDecisionEvidenceTypeIdentity.ts", import.meta.url),
  "utf8"
);
const decisionsSource = readFileSync(
  new URL("../services/domain/operationalFindingDecisions.ts", import.meta.url),
  "utf8"
);

const evidenceType = "inventory_item";
const evidenceId = "item-chicken";

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
          id: evidenceId,
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

test("MISE-005NK pins finding-decision evidence type to ASCII C", () => {
  assert.match(identitySource, /MISE-005NK/);
  assert.match(decisionsSource, /MISE-005NK/);

  assert.match(
    identitySource,
    /export function asciiTrimOperationalFindingDecisionEvidenceTypeToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    decisionsSource,
    /requireCanonicalOperationalFindingDecisionEvidenceType\(record\.type\)/
  );
  assert.match(
    decisionsSource,
    /from "\.\/operationalFindingDecisionEvidenceTypeIdentity"/
  );

  // Leave restaurant workspace, finding.id, evidence id/summary, and object
  // identities on Unicode trim for sibling tips.
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

  // Do not rewrite sibling tips.
  assert.doesNotMatch(identitySource, /operationalFindingDecisionEvidenceIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionObjectIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /findingDecisionOutboxIdentity/);
  assert.doesNotMatch(identitySource, /findingDecisionOutboxKeyPrefixIdentity/);
  assert.doesNotMatch(decisionsSource, /operationalFindingDecisionEvidenceIdentity/);
  assert.doesNotMatch(decisionsSource, /operationalFindingDecisionObjectIdentity/);
  assert.doesNotMatch(decisionsSource, /operationalFindingDecisionRestaurantIdentity/);
});

test("ASCII trim keeps ordinary finding-decision evidence type padding stable", () => {
  assert.equal(
    asciiTrimOperationalFindingDecisionEvidenceTypeToken(`  ${evidenceType}  `),
    evidenceType
  );
  assert.equal(
    canonicalizeOperationalFindingDecisionEvidenceType(`\t${evidenceType}\n`),
    evidenceType
  );
  assert.equal(
    requireCanonicalOperationalFindingDecisionEvidenceType(`  ${evidenceType}  `),
    evidenceType
  );

  const normalized = normalizeOperationalFindingDecisionInput(
    baseInput({
      finding: {
        ...baseInput().finding,
        evidence: [
          {
            type: `  ${evidenceType}  ` as OperationalFindingDecisionInput["finding"]["evidence"][number]["type"],
            id: evidenceId,
            observedAt: "2026-10-11T12:00:00.000Z",
            summary: "Low stock"
          }
        ]
      }
    })
  );
  assert.equal(normalized.finding.evidence[0]?.type, evidenceType);

  const response = normalizeOperationalFindingDecision(
    {
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
          type: `  ${evidenceType}  `,
          id: evidenceId,
          observedAt: "2026-10-11T12:00:00.000Z",
          summary: "Low stock"
        }
      ],
      original_recommended_action: "Count chicken",
      edited_recommended_action: null,
      client_event_id: "device-event-1",
      idempotency_key: "finding-decision:device-event-1",
      actor_user_id: null,
      recorded_at: "2026-10-11T12:10:00.000Z"
    },
    "restaurant-a"
  );
  assert.equal(response.evidence[0]?.type, evidenceType);
});

test("Unicode end padding does not invent a finding-decision evidence type enum token", () => {
  const nbspType = `\u00a0${evidenceType}\u00a0`;
  const emType = `\u2003${evidenceType}\u2003`;

  assert.equal(nbspType.trim(), evidenceType);
  assert.equal(emType.trim(), evidenceType);
  assert.equal(canonicalizeOperationalFindingDecisionEvidenceType(nbspType), null);
  assert.equal(canonicalizeOperationalFindingDecisionEvidenceType(emType), null);

  assert.throws(
    () => requireCanonicalOperationalFindingDecisionEvidenceType(nbspType),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding evidence type is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingDecisionEvidenceType(emType),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding evidence type is invalid."
  );

  assert.throws(
    () =>
      normalizeOperationalFindingDecisionInput(
        baseInput({
          finding: {
            ...baseInput().finding,
            evidence: [
              {
                type: nbspType as OperationalFindingDecisionInput["finding"]["evidence"][number]["type"],
                id: evidenceId,
                observedAt: "2026-10-11T12:00:00.000Z",
                summary: "Low stock"
              }
            ]
          }
        })
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding evidence type is invalid."
  );
  assert.throws(
    () =>
      normalizeOperationalFindingDecisionInput(
        baseInput({
          finding: {
            ...baseInput().finding,
            evidence: [
              {
                type: emType as OperationalFindingDecisionInput["finding"]["evidence"][number]["type"],
                id: evidenceId,
                observedAt: "2026-10-11T12:00:00.000Z",
                summary: "Low stock"
              }
            ]
          }
        })
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding evidence type is invalid."
  );

  assert.throws(
    () =>
      normalizeOperationalFindingDecision(
        {
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
              type: nbspType,
              id: evidenceId,
              observedAt: "2026-10-11T12:00:00.000Z",
              summary: "Low stock"
            }
          ],
          original_recommended_action: "Count chicken",
          edited_recommended_action: null,
          client_event_id: "device-event-1",
          idempotency_key: "finding-decision:device-event-1",
          actor_user_id: null,
          recorded_at: "2026-10-11T12:10:00.000Z"
        },
        "restaurant-a"
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding evidence type is invalid."
  );
});

test("Empty, control, over-long, unknown, and non-string finding-decision evidence types fail closed", () => {
  assert.equal(canonicalizeOperationalFindingDecisionEvidenceType(""), null);
  assert.equal(canonicalizeOperationalFindingDecisionEvidenceType("   "), null);
  assert.equal(canonicalizeOperationalFindingDecisionEvidenceType("a\u0000b"), null);
  assert.equal(canonicalizeOperationalFindingDecisionEvidenceType("x".repeat(81)), null);

  assert.throws(
    () => requireCanonicalOperationalFindingDecisionEvidenceType(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding evidence type is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingDecisionEvidenceType(12),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding evidence type is invalid."
  );

  assert.throws(
    () =>
      normalizeOperationalFindingDecisionInput(
        baseInput({
          finding: {
            ...baseInput().finding,
            evidence: [
              {
                type: "not_a_real_evidence_type" as OperationalFindingDecisionInput["finding"]["evidence"][number]["type"],
                id: evidenceId,
                observedAt: "2026-10-11T12:00:00.000Z",
                summary: "Low stock"
              }
            ]
          }
        })
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding evidence type is invalid."
  );
});

test("Input finding.id pattern gate fail-closes Unicode padding before trim inventing", () => {
  // Proven non-inventing on the input path: pattern tests the raw id before
  // `.trim()`, so NBSP/em-space padding never reaches identity inventing.
  const paddedFindingId = `\u00a0finding:inventory:low_stock:item1\u00a0`;
  assert.equal(paddedFindingId.trim(), "finding:inventory:low_stock:item1");
  assert.throws(
    () =>
      normalizeOperationalFindingDecisionInput(
        baseInput({
          finding: {
            ...baseInput().finding,
            id: paddedFindingId
          }
        })
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding identity is invalid."
  );
});

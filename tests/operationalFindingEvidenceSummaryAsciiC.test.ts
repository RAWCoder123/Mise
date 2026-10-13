import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeOperationalFindingDecision,
  normalizeOperationalFindingDecisionInput,
  operationalFindingDecisionRpcArguments,
  type OperationalFindingDecisionInput
} from "../services/domain/operationalFindingDecisions";
import {
  canonicalOperationalFindingEvidenceSummary,
  requireCanonicalOperationalFindingEvidenceSummary
} from "../services/domain/operationalFindingEvidenceSummaryIdentity";
import type { OperationalFinding } from "../services/domain/operationalFindings";

const identitySource = readFileSync(
  new URL("../services/domain/operationalFindingEvidenceSummaryIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/operationalFindingDecisions.ts", import.meta.url),
  "utf8"
);

const restaurantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const summary = "Chicken has less than one service day of coverage.";
const multilineSummary =
  "Chicken has less than one service day of coverage.\nWalk-in shelf B2.\nPhoto attached.";
const accentedSummary = "El pollo tiene menos de un día de cobertura.";

const finding: OperationalFinding = {
  id: "finding:recommendation:chicken",
  restaurantId,
  category: "ordering",
  severity: "urgent",
  priority: "now",
  title: "Review chicken coverage",
  explanation: "Projected inventory is below the configured operating level.",
  confidence: { score: 0.92, rationale: "Verified restaurant evidence." },
  evidence: [
    {
      type: "inventory_item",
      id: "item-chicken",
      observedAt: "2026-07-28T12:00:00.000Z",
      summary
    }
  ],
  affectedWorkflow: "inventory_and_ordering",
  recommendedAction: "Review 38 lb from Fresh Produce Co.",
  sourceWindow: {
    start: "2026-07-28T12:00:00.000Z",
    end: "2026-07-28T12:00:00.000Z"
  },
  generatedAt: "2026-07-28T12:05:00.000Z",
  freshness: {
    state: "fresh",
    asOf: "2026-07-28T12:00:00.000Z",
    staleAfter: "2026-07-30T12:00:00.000Z",
    missingData: []
  },
  managerFeedback: {
    state: "unreviewed",
    decisionId: null,
    recordedAt: null,
    effectiveRecommendedAction: "Review 38 lb from Fresh Produce Co."
  },
  policyVersion: "beta-findings-v1"
};

function input(
  overrides: Partial<OperationalFindingDecisionInput> & {
    finding?: OperationalFinding;
  } = {}
): OperationalFindingDecisionInput {
  return {
    restaurantId,
    finding,
    decisionType: "approved",
    clientEventId: "device-a:finding-decision-1",
    idempotencyKey: "finding-decision:device-a:1",
    ...overrides
  };
}

function withEvidenceSummary(nextSummary: string): OperationalFinding {
  return {
    ...finding,
    evidence: [{ ...finding.evidence[0]!, summary: nextSummary }]
  };
}

test("MISE-005OW pins finding evidence summary to ASCII C multiline free-text prep", () => {
  assert.match(identitySource, /MISE-005OW/);
  assert.match(domainSource, /MISE-005OW/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalOperationalFindingEvidenceSummary("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  assert.doesNotMatch(canonicalBody, /C_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.doesNotMatch(canonicalBody, /\.replace\(C_WHITESPACE/);

  assert.match(
    domainSource,
    /summary: requireCanonicalOperationalFindingEvidenceSummary\(record\.summary\)/
  );
  assert.match(domainSource, /from "\.\/operationalFindingEvidenceSummaryIdentity"/);

  // Leave sibling requireBoundedText surfaces on Unicode trim until tipped.
  assert.match(
    domainSource,
    /const restaurantId = requireBoundedText\(input\.restaurantId, "Restaurant workspace", 64\);/
  );
  assert.match(
    domainSource,
    /id: requireBoundedText\(record\.id, "Finding evidence identity", 240\),/
  );
  assert.match(
    domainSource,
    /const type = requireBoundedText\(record\.type, "Finding evidence type", 80\);/
  );
  assert.match(
    domainSource,
    /input\.finding\.recommendedAction,\s*"Finding recommended action",\s*320/
  );
  assert.match(
    domainSource,
    /requireBoundedText\(input\.editedRecommendedAction, "Edited recommended action", 320\)/
  );
  assert.match(
    domainSource,
    /clientEventId: requireBoundedText\(input\.clientEventId, "Finding decision event identity", 200\),/
  );
  assert.match(
    domainSource,
    /idempotencyKey: requireBoundedText\(input\.idempotencyKey, "Finding decision idempotency key", 240\)/
  );

  assert.doesNotMatch(identitySource, /operationalFindingDecisionRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionEvidenceIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionEvidenceTypeIdentity/);
  assert.doesNotMatch(identitySource, /restaurantMemoryStatementIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsErrorIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\.\/miseValidation"/);
  assert.doesNotMatch(domainSource, /restaurantMemoryStatementIdentity/);
});

test("ASCII C multiline prep keeps ordinary finding evidence summaries stable", () => {
  assert.equal(canonicalOperationalFindingEvidenceSummary(`  ${summary}  `), summary);
  assert.equal(canonicalOperationalFindingEvidenceSummary(`\t${summary}\n`), summary);
  assert.equal(requireCanonicalOperationalFindingEvidenceSummary(`  ${summary}  `), summary);
  assert.equal(canonicalOperationalFindingEvidenceSummary(accentedSummary), accentedSummary);
  assert.equal(requireCanonicalOperationalFindingEvidenceSummary(accentedSummary), accentedSummary);

  // Internal LF/TAB/CR are preserved (operator_note-style multiline).
  assert.equal(canonicalOperationalFindingEvidenceSummary(multilineSummary), multilineSummary);
  assert.equal(
    requireCanonicalOperationalFindingEvidenceSummary(multilineSummary),
    multilineSummary
  );

  const normalized = normalizeOperationalFindingDecisionInput(
    input({ finding: withEvidenceSummary(`  ${summary}  `) })
  );
  assert.equal(normalized.finding.evidence[0]?.summary, summary);

  const args = operationalFindingDecisionRpcArguments(
    input({ finding: withEvidenceSummary(multilineSummary) })
  );
  assert.equal((args.p_evidence as { summary: string }[])[0]?.summary, multilineSummary);
});

test("NBSP folds and em-space padding cannot invent finding evidence summaries", () => {
  const nbspSummary = `\u00a0${summary}\u00a0`;
  const emSummary = `\u2003${summary}\u2003`;
  const internalEm = `Chicken\u2003coverage`;
  const internalNbsp = `Chicken\u00a0coverage`;
  const emMultiline = `\u2003${multilineSummary}\u2003`;

  // Pasted NBSP is folded like MISE-005B / #821 / #823 / #824 / #827–#830 free-text prep.
  assert.equal(nbspSummary.trim(), summary);
  assert.equal(canonicalOperationalFindingEvidenceSummary(nbspSummary), summary);
  assert.equal(requireCanonicalOperationalFindingEvidenceSummary(nbspSummary), summary);
  assert.equal(canonicalOperationalFindingEvidenceSummary(internalNbsp), "Chicken coverage");

  const nbspNormalized = normalizeOperationalFindingDecisionInput(
    input({ finding: withEvidenceSummary(nbspSummary) })
  );
  assert.equal(nbspNormalized.finding.evidence[0]?.summary, summary);

  // Unicode em-space trim invents a clean summary; C free-text prep does not.
  assert.equal(emSummary.trim(), summary);
  assert.notEqual(canonicalOperationalFindingEvidenceSummary(emSummary), summary);
  assert.equal(canonicalOperationalFindingEvidenceSummary(emSummary), emSummary);
  assert.equal(requireCanonicalOperationalFindingEvidenceSummary(emSummary), emSummary);

  const emNormalized = normalizeOperationalFindingDecisionInput(
    input({ finding: withEvidenceSummary(emSummary) })
  );
  assert.equal(emNormalized.finding.evidence[0]?.summary, emSummary);
  assert.notEqual(emNormalized.finding.evidence[0]?.summary, summary);

  assert.equal(canonicalOperationalFindingEvidenceSummary(internalEm), internalEm);
  assert.notEqual(
    canonicalOperationalFindingEvidenceSummary(internalEm),
    canonicalOperationalFindingEvidenceSummary("Chicken coverage")
  );

  assert.equal(emMultiline.trim(), multilineSummary);
  assert.notEqual(canonicalOperationalFindingEvidenceSummary(emMultiline), multilineSummary);
  assert.equal(canonicalOperationalFindingEvidenceSummary(emMultiline), emMultiline);
  assert.equal(requireCanonicalOperationalFindingEvidenceSummary(emMultiline), emMultiline);

  const emMultilineNormalized = normalizeOperationalFindingDecisionInput(
    input({ finding: withEvidenceSummary(emMultiline) })
  );
  assert.equal(emMultilineNormalized.finding.evidence[0]?.summary, emMultiline);

  // Kelvin is not folded to k; accents/case stay presentation-faithful.
  assert.equal(
    canonicalOperationalFindingEvidenceSummary("Kelvin coverage risk"),
    "Kelvin coverage risk"
  );
  assert.notEqual(
    canonicalOperationalFindingEvidenceSummary("Kelvin coverage risk"),
    canonicalOperationalFindingEvidenceSummary("Kelvin coverage risk")
  );

  // Hydrate path uses the same summary pin.
  const raw = {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    sequence: 7,
    restaurant_id: restaurantId,
    finding_id: finding.id,
    policy_version: finding.policyVersion,
    decision_type: "approved",
    finding_generated_at: finding.generatedAt,
    finding_category: finding.category,
    severity: finding.severity,
    confidence_score: finding.confidence.score,
    evidence: [{ ...finding.evidence[0]!, summary: emSummary }],
    original_recommended_action: finding.recommendedAction,
    edited_recommended_action: null,
    client_event_id: "device-a:finding-decision-2",
    idempotency_key: "finding-decision:device-a:2",
    actor_user_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    recorded_at: "2026-07-28T12:10:00.000Z"
  };
  const hydrated = normalizeOperationalFindingDecision(raw, restaurantId);
  assert.equal(hydrated.evidence[0]?.summary, emSummary);
  assert.notEqual(hydrated.evidence[0]?.summary, summary);
});

test("finding evidence summaries fail closed on empty, unsafe control, and over-long", () => {
  assert.throws(
    () => requireCanonicalOperationalFindingEvidenceSummary(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding evidence summary is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingEvidenceSummary("   "),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding evidence summary is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingEvidenceSummary("\u00a0\u00a0"),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding evidence summary is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingEvidenceSummary("\u2003"),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding evidence summary is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingEvidenceSummary("\n\t\r"),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding evidence summary is invalid."
  );

  assert.throws(
    () =>
      normalizeOperationalFindingDecisionInput(
        input({ finding: withEvidenceSummary("\u2003") })
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding evidence summary is invalid."
  );

  assert.throws(
    () => requireCanonicalOperationalFindingEvidenceSummary(123),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding evidence summary is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingEvidenceSummary("Bad\u0000Summary"),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding evidence summary is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingEvidenceSummary("Bad\u000bSummary"),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding evidence summary is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingEvidenceSummary("Bad\u000cSummary"),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding evidence summary is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingEvidenceSummary("Bad\u007fSummary"),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding evidence summary is invalid."
  );
  assert.equal(
    requireCanonicalOperationalFindingEvidenceSummary("Chicken\tcoverage\nrisk."),
    "Chicken\tcoverage\nrisk."
  );

  assert.throws(
    () => requireCanonicalOperationalFindingEvidenceSummary("x".repeat(241)),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding evidence summary is invalid."
  );
  assert.equal(requireCanonicalOperationalFindingEvidenceSummary("x".repeat(240)).length, 240);
});

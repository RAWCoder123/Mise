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
  canonicalOperationalFindingRecommendedAction,
  requireCanonicalOperationalFindingEditedRecommendedAction,
  requireCanonicalOperationalFindingRecommendedAction
} from "../services/domain/operationalFindingRecommendedActionIdentity";
import type { OperationalFinding } from "../services/domain/operationalFindings";

const identitySource = readFileSync(
  new URL("../services/domain/operationalFindingRecommendedActionIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/operationalFindingDecisions.ts", import.meta.url),
  "utf8"
);

const restaurantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const recommendedAction = "Review 38 lb from Fresh Produce Co.";
const editedAction = "Review 30 lb after recounting.";
const multilineAction =
  "Review 38 lb from Fresh Produce Co.\nWalk-in shelf B2.\nConfirm before cutoff.";
const accentedAction = "Revisar 38 lb de Fresh Produce Co.";

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
      summary: "Chicken has less than one service day of coverage."
    }
  ],
  affectedWorkflow: "inventory_and_ordering",
  recommendedAction,
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
    effectiveRecommendedAction: recommendedAction
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

function withRecommendedAction(nextAction: string): OperationalFinding {
  return {
    ...finding,
    recommendedAction: nextAction,
    managerFeedback: {
      ...finding.managerFeedback,
      effectiveRecommendedAction: nextAction
    }
  };
}

test("MISE-005OX pins finding recommended-action free-text to ASCII C multiline prep", () => {
  assert.match(identitySource, /MISE-005OX/);
  assert.match(domainSource, /MISE-005OX/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalOperationalFindingRecommendedAction("),
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
    /requireCanonicalOperationalFindingRecommendedAction\(\s*input\.finding\.recommendedAction\s*\)/
  );
  assert.match(
    domainSource,
    /requireCanonicalOperationalFindingEditedRecommendedAction\(\s*input\.editedRecommendedAction\s*\)/
  );
  assert.match(
    domainSource,
    /requireCanonicalOperationalFindingRecommendedAction\(\s*record\.original_recommended_action\s*\)/
  );
  assert.match(
    domainSource,
    /requireCanonicalOperationalFindingEditedRecommendedAction\(\s*record\.edited_recommended_action\s*\)/
  );
  assert.match(domainSource, /from "\.\/operationalFindingRecommendedActionIdentity"/);

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
    /summary: requireBoundedText\(record\.summary, "Finding evidence summary", 240\)/
  );
  assert.match(
    domainSource,
    /clientEventId: requireBoundedText\(input\.clientEventId, "Finding decision event identity", 200\),/
  );
  assert.match(
    domainSource,
    /idempotencyKey: requireBoundedText\(input\.idempotencyKey, "Finding decision idempotency key", 240\)/
  );

  assert.doesNotMatch(identitySource, /operationalFindingEvidenceSummaryIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingDecisionEvidenceIdentity/);
  assert.doesNotMatch(identitySource, /restaurantMemoryStatementIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsErrorIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\.\/miseValidation"/);
  assert.doesNotMatch(domainSource, /operationalFindingEvidenceSummaryIdentity/);
  assert.doesNotMatch(domainSource, /restaurantMemoryStatementIdentity/);
});

test("ASCII C multiline prep keeps ordinary finding recommended actions stable", () => {
  assert.equal(canonicalOperationalFindingRecommendedAction(`  ${recommendedAction}  `), recommendedAction);
  assert.equal(canonicalOperationalFindingRecommendedAction(`\t${recommendedAction}\n`), recommendedAction);
  assert.equal(
    requireCanonicalOperationalFindingRecommendedAction(`  ${recommendedAction}  `),
    recommendedAction
  );
  assert.equal(canonicalOperationalFindingRecommendedAction(accentedAction), accentedAction);
  assert.equal(requireCanonicalOperationalFindingRecommendedAction(accentedAction), accentedAction);

  // Internal LF/TAB/CR are preserved (operator_note-style multiline).
  assert.equal(canonicalOperationalFindingRecommendedAction(multilineAction), multilineAction);
  assert.equal(
    requireCanonicalOperationalFindingRecommendedAction(multilineAction),
    multilineAction
  );

  const normalized = normalizeOperationalFindingDecisionInput(
    input({ finding: withRecommendedAction(`  ${recommendedAction}  `) })
  );
  assert.equal(normalized.finding.recommendedAction, recommendedAction);

  const editedNormalized = normalizeOperationalFindingDecisionInput(
    input({
      decisionType: "edited",
      editedRecommendedAction: `  ${editedAction}  `,
      finding: withRecommendedAction(recommendedAction)
    })
  );
  assert.equal(editedNormalized.editedRecommendedAction, editedAction);

  const args = operationalFindingDecisionRpcArguments(
    input({ finding: withRecommendedAction(multilineAction) })
  );
  assert.equal(args.p_original_recommended_action, multilineAction);
});

test("NBSP folds and em-space padding cannot invent finding recommended actions", () => {
  const nbspAction = `\u00a0${recommendedAction}\u00a0`;
  const emAction = `\u2003${recommendedAction}\u2003`;
  const internalEm = `Review\u200338 lb`;
  const internalNbsp = `Review\u00a038 lb`;
  const emMultiline = `\u2003${multilineAction}\u2003`;
  const emEdited = `\u2003${editedAction}\u2003`;

  // Pasted NBSP is folded like MISE-005B / #821 / #823 / #824 / #827–#831 free-text prep.
  assert.equal(nbspAction.trim(), recommendedAction);
  assert.equal(canonicalOperationalFindingRecommendedAction(nbspAction), recommendedAction);
  assert.equal(requireCanonicalOperationalFindingRecommendedAction(nbspAction), recommendedAction);
  assert.equal(canonicalOperationalFindingRecommendedAction(internalNbsp), "Review 38 lb");

  const nbspNormalized = normalizeOperationalFindingDecisionInput(
    input({ finding: withRecommendedAction(nbspAction) })
  );
  assert.equal(nbspNormalized.finding.recommendedAction, recommendedAction);

  // Unicode em-space trim invents a clean action; C free-text prep does not.
  assert.equal(emAction.trim(), recommendedAction);
  assert.notEqual(canonicalOperationalFindingRecommendedAction(emAction), recommendedAction);
  assert.equal(canonicalOperationalFindingRecommendedAction(emAction), emAction);
  assert.equal(requireCanonicalOperationalFindingRecommendedAction(emAction), emAction);

  const emNormalized = normalizeOperationalFindingDecisionInput(
    input({ finding: withRecommendedAction(emAction) })
  );
  assert.equal(emNormalized.finding.recommendedAction, emAction);
  assert.notEqual(emNormalized.finding.recommendedAction, recommendedAction);

  assert.equal(canonicalOperationalFindingRecommendedAction(internalEm), internalEm);
  assert.notEqual(
    canonicalOperationalFindingRecommendedAction(internalEm),
    canonicalOperationalFindingRecommendedAction("Review 38 lb")
  );

  assert.equal(emMultiline.trim(), multilineAction);
  assert.notEqual(canonicalOperationalFindingRecommendedAction(emMultiline), multilineAction);
  assert.equal(canonicalOperationalFindingRecommendedAction(emMultiline), emMultiline);
  assert.equal(requireCanonicalOperationalFindingRecommendedAction(emMultiline), emMultiline);

  const emMultilineNormalized = normalizeOperationalFindingDecisionInput(
    input({ finding: withRecommendedAction(emMultiline) })
  );
  assert.equal(emMultilineNormalized.finding.recommendedAction, emMultiline);

  assert.equal(emEdited.trim(), editedAction);
  assert.notEqual(
    requireCanonicalOperationalFindingEditedRecommendedAction(emEdited),
    editedAction
  );
  assert.equal(requireCanonicalOperationalFindingEditedRecommendedAction(emEdited), emEdited);

  const emEditedNormalized = normalizeOperationalFindingDecisionInput(
    input({
      decisionType: "edited",
      editedRecommendedAction: emEdited,
      finding: withRecommendedAction(recommendedAction)
    })
  );
  assert.equal(emEditedNormalized.editedRecommendedAction, emEdited);
  assert.notEqual(emEditedNormalized.editedRecommendedAction, editedAction);

  // Kelvin is not folded to k; accents/case stay presentation-faithful.
  assert.equal(
    canonicalOperationalFindingRecommendedAction("Kelvin coverage risk"),
    "Kelvin coverage risk"
  );
  assert.notEqual(
    canonicalOperationalFindingRecommendedAction("Kelvin coverage risk"),
    canonicalOperationalFindingRecommendedAction("Kelvin coverage risk")
  );

  // Hydrate path uses the same recommended-action pins.
  const raw = {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    sequence: 7,
    restaurant_id: restaurantId,
    finding_id: finding.id,
    policy_version: finding.policyVersion,
    decision_type: "edited",
    finding_generated_at: finding.generatedAt,
    finding_category: finding.category,
    severity: finding.severity,
    confidence_score: finding.confidence.score,
    evidence: finding.evidence,
    original_recommended_action: emAction,
    edited_recommended_action: emEdited,
    client_event_id: "device-a:finding-decision-2",
    idempotency_key: "finding-decision:device-a:2",
    actor_user_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    recorded_at: "2026-07-28T12:10:00.000Z"
  };
  const hydrated = normalizeOperationalFindingDecision(raw, restaurantId);
  assert.equal(hydrated.originalRecommendedAction, emAction);
  assert.notEqual(hydrated.originalRecommendedAction, recommendedAction);
  assert.equal(hydrated.editedRecommendedAction, emEdited);
  assert.notEqual(hydrated.editedRecommendedAction, editedAction);
});

test("finding recommended actions fail closed on empty, unsafe control, and over-long", () => {
  assert.throws(
    () => requireCanonicalOperationalFindingRecommendedAction(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding recommended action is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingRecommendedAction("   "),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding recommended action is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingRecommendedAction("\u00a0\u00a0"),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding recommended action is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingRecommendedAction("\u2003"),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding recommended action is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingRecommendedAction("\n\t\r"),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding recommended action is invalid."
  );

  assert.throws(
    () =>
      normalizeOperationalFindingDecisionInput(
        input({ finding: withRecommendedAction("\u2003") })
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding recommended action is invalid."
  );

  assert.throws(
    () => requireCanonicalOperationalFindingRecommendedAction(123),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding recommended action is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingRecommendedAction("Bad\u0000Action"),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding recommended action is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingRecommendedAction("Bad\u000bAction"),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding recommended action is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingRecommendedAction("Bad\u000cAction"),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding recommended action is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingRecommendedAction("Bad\u007fAction"),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding recommended action is invalid."
  );
  assert.equal(
    requireCanonicalOperationalFindingRecommendedAction("Review\t38 lb\nbefore cutoff."),
    "Review\t38 lb\nbefore cutoff."
  );

  assert.throws(
    () => requireCanonicalOperationalFindingRecommendedAction("x".repeat(321)),
    (error: unknown) =>
      error instanceof Error && error.message === "Finding recommended action is invalid."
  );
  assert.equal(requireCanonicalOperationalFindingRecommendedAction("x".repeat(320)).length, 320);

  assert.throws(
    () => requireCanonicalOperationalFindingEditedRecommendedAction(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Edited recommended action is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingEditedRecommendedAction("\u2003"),
    (error: unknown) =>
      error instanceof Error && error.message === "Edited recommended action is invalid."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingEditedRecommendedAction("x".repeat(321)),
    (error: unknown) =>
      error instanceof Error && error.message === "Edited recommended action is invalid."
  );
  assert.equal(
    requireCanonicalOperationalFindingEditedRecommendedAction("x".repeat(320)).length,
    320
  );

  assert.throws(
    () =>
      normalizeOperationalFindingDecisionInput(
        input({
          decisionType: "edited",
          editedRecommendedAction: "\u2003",
          finding
        })
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Edited recommended action is invalid."
  );
});

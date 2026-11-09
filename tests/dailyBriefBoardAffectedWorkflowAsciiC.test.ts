import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDailyBriefBoardAffectedWorkflow,
  canonicalizeDailyBriefBoardAffectedWorkflow,
  normalizeDailyBriefBoardAffectedWorkflow
} from "../services/domain/presentationDailyBriefBoardAffectedWorkflowIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationDailyBriefBoardAffectedWorkflowIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const boardSource = readFileSync(
  new URL("../components/dailyBrief/DailyBriefBoard.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const findingsSource = readFileSync(
  new URL("../services/domain/operationalFindings.ts", import.meta.url),
  "utf8"
);
const boardTitleIdentityPath = new URL(
  "../services/domain/presentationDailyBriefBoardFindingTitleIdentity.ts",
  import.meta.url
);
const boardExplanationIdentityPath = new URL(
  "../services/domain/presentationDailyBriefBoardExplanationIdentity.ts",
  import.meta.url
);
const boardRecommendedActionIdentityPath = new URL(
  "../services/domain/presentationDailyBriefBoardRecommendedActionIdentity.ts",
  import.meta.url
);
const boardEffectiveRecommendedActionIdentityPath = new URL(
  "../services/domain/presentationDailyBriefBoardEffectiveRecommendedActionIdentity.ts",
  import.meta.url
);
const missingDataItemIdentityPath = new URL(
  "../services/domain/presentationDailyBriefMissingDataItemIdentity.ts",
  import.meta.url
);

const workflow = "inventory_and_ordering";
const em = "\u2003";
const nbsp = "\u00a0";

function filePresence(path: URL) {
  try {
    readFileSync(path, "utf8");
    return "present";
  } catch {
    return "absent";
  }
}

test("MISE-005AAQ pins Daily Brief Board affectedWorkflow to ASCII C", () => {
  assert.match(identitySource, /MISE-005AAQ/);
  assert.match(boardSource, /MISE-005AAQ/);

  assert.match(
    identitySource,
    /export function asciiTrimDailyBriefBoardAffectedWorkflow\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    boardSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationDailyBriefBoardAffectedWorkflowIdentity"/
  );
  assert.match(boardSource, /normalizeDailyBriefBoardAffectedWorkflow\(/);
  assert.match(
    boardSource,
    /normalizeDailyBriefBoardAffectedWorkflow\(\s*finding\.affectedWorkflow\s*\)\s*\|\|\s*t\("dailyBrief\.workflow\.none"\)/
  );
  assert.doesNotMatch(
    boardSource,
    /t\("dailyBrief\.workflow",\s*\{\s*workflow:\s*finding\.affectedWorkflow\s*\}\)/
  );

  assert.match(catalogSource, /"dailyBrief\.workflow\.none": "Not specified"/);
  assert.match(catalogSource, /"dailyBrief\.workflow\.none": "No especificado"/);
  assert.match(catalogSource, /"dailyBrief\.workflow\.none": "未指定"/);

  // Leave Board title / explanation / recommendedAction / annotation /
  // missingData as raw pass-through on this tip.
  assert.match(boardSource, />\s*\{finding\.title\}\s*<\/Text>/);
  assert.match(boardSource, /\{finding\.explanation\}/);
  assert.match(boardSource, /\{finding\.recommendedAction\}/);
  assert.match(boardSource, /\{finding\.managerFeedback\.effectiveRecommendedAction\}/);
  assert.match(
    boardSource,
    /t\("dailyBrief\.missingData",\s*\{\s*items:\s*finding\.freshness\.missingData\.join\(", "\)\s*\}\)/
  );
  assert.match(boardSource, /accessibilityLabel=\{`\$\{finding\.title\}\. \$\{severityLabel\}`\}/);

  // Leave sibling Board / missingData tips alone.
  assert.doesNotMatch(boardSource, /presentationDailyBriefBoardFindingTitleIdentity/);
  assert.doesNotMatch(boardSource, /normalizeDailyBriefBoardFindingTitle/);
  assert.doesNotMatch(boardSource, /presentationDailyBriefBoardExplanationIdentity/);
  assert.doesNotMatch(boardSource, /presentationDailyBriefBoardRecommendedActionIdentity/);
  assert.doesNotMatch(boardSource, /presentationDailyBriefMissingDataItemIdentity/);
  assert.doesNotMatch(boardSource, /normalizeDailyBriefMissingDataItem/);

  // Prove free-form inventing beyond a single controlled enum: typed string +
  // insight.insight_type passthrough + ad-hoc workflow literals.
  assert.match(findingsSource, /affectedWorkflow:\s*string/);
  assert.match(findingsSource, /affectedWorkflow:\s*insight\.insight_type/);
  assert.match(findingsSource, /affectedWorkflow:\s*"inventory_and_ordering"/);
  assert.match(findingsSource, /affectedWorkflow:\s*"daily_sales_import"/);
  assert.match(findingsSource, /affectedWorkflow:\s*"inventory_setup"/);
  assert.match(findingsSource, /affectedWorkflow:\s*"recipe_mapping"/);

  assert.equal(filePresence(boardTitleIdentityPath), "absent");
  assert.equal(filePresence(boardExplanationIdentityPath), "absent");
  assert.equal(filePresence(boardRecommendedActionIdentityPath), "absent");
  assert.equal(filePresence(boardEffectiveRecommendedActionIdentityPath), "absent");
  assert.equal(filePresence(missingDataItemIdentityPath), "absent");

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationDailyBriefBoardFindingTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyBriefBoardExplanationIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyBriefBoardRecommendedActionIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyBriefMissingDataItemIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeDailyBriefBoardAffectedWorkflow(workflow), workflow);
  assert.equal(normalizeDailyBriefBoardAffectedWorkflow(` ${workflow} `), workflow);
  assert.equal(
    normalizeDailyBriefBoardAffectedWorkflow(`Case-${workflow}`),
    `Case-${workflow}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Daily Brief Board affectedWorkflow", () => {
  const padded = `${em}${workflow}${em}`;
  const nbspWorkflow = `${nbsp}${workflow}${nbsp}`;
  const internalEm = `inventory${em}ordering`;
  const internalNbsp = `inventory${nbsp}ordering`;

  // Inventing proof: Unicode trim would invent the clean workflow token.
  assert.equal(padded.trim(), workflow);
  assert.equal(nbspWorkflow.trim(), workflow);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspWorkflow), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimDailyBriefBoardAffectedWorkflow(padded), padded);
  assert.equal(canonicalizeDailyBriefBoardAffectedWorkflow(padded), null);
  assert.equal(canonicalizeDailyBriefBoardAffectedWorkflow(nbspWorkflow), null);
  assert.equal(normalizeDailyBriefBoardAffectedWorkflow(padded), null);
  assert.equal(normalizeDailyBriefBoardAffectedWorkflow(nbspWorkflow), null);
  assert.equal(normalizeDailyBriefBoardAffectedWorkflow(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeDailyBriefBoardAffectedWorkflow(internalEm), internalEm);
  assert.equal(normalizeDailyBriefBoardAffectedWorkflow(internalNbsp), internalNbsp);
  assert.equal(normalizeDailyBriefBoardAffectedWorkflow(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Daily Brief Board affectedWorkflow", () => {
  assert.equal(normalizeDailyBriefBoardAffectedWorkflow(undefined), null);
  assert.equal(normalizeDailyBriefBoardAffectedWorkflow(null), null);
  assert.equal(normalizeDailyBriefBoardAffectedWorkflow(""), null);
  assert.equal(normalizeDailyBriefBoardAffectedWorkflow("   "), null);
  assert.equal(normalizeDailyBriefBoardAffectedWorkflow(123 as unknown as string), null);
  assert.equal(normalizeDailyBriefBoardAffectedWorkflow(`\u0001${workflow}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeDailyBriefBoardAffectedWorkflow(`${workflow}\t`), workflow);
  assert.equal(normalizeDailyBriefBoardAffectedWorkflow(`${workflow}\u0007`), null);
  assert.equal(normalizeDailyBriefBoardAffectedWorkflow(em), null);
  // LF/TAB/CR are rejected for single-line workflows (full cntrl; no multiline allowlist).
  assert.equal(normalizeDailyBriefBoardAffectedWorkflow(`inventory\tordering`), null);
  assert.equal(normalizeDailyBriefBoardAffectedWorkflow(`inventory\nordering`), null);
});

test("Daily Brief Board bypass proof: empty and Unicode-only-space workflows soft-null to localized none", () => {
  // Prior always-pass-workflow path still rendered blank-looking `{workflow}`.
  assert.equal(normalizeDailyBriefBoardAffectedWorkflow(""), null);
  assert.equal(normalizeDailyBriefBoardAffectedWorkflow(em), null);
  assert.equal(normalizeDailyBriefBoardAffectedWorkflow(nbsp), null);
  assert.match(
    boardSource,
    /normalizeDailyBriefBoardAffectedWorkflow\(\s*finding\.affectedWorkflow\s*\)\s*\|\|\s*t\("dailyBrief\.workflow\.none"\)/
  );
});

test("Daily Brief Board affectedWorkflow identity refuses Unicode inventing equality", () => {
  const padded = `${em}${workflow}${em}`;
  assert.notEqual(asciiTrimDailyBriefBoardAffectedWorkflow(padded), padded.trim());
  assert.equal(normalizeDailyBriefBoardAffectedWorkflow(padded), null);
  assert.equal(
    normalizeDailyBriefBoardAffectedWorkflow(padded) || "Not specified",
    "Not specified"
  );
  assert.notEqual(normalizeDailyBriefBoardAffectedWorkflow(workflow), null);
});

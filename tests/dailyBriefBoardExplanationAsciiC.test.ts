import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalDailyBriefBoardExplanation,
  normalizeDailyBriefBoardExplanation
} from "../services/domain/presentationDailyBriefBoardExplanationIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationDailyBriefBoardExplanationIdentity.ts", import.meta.url),
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
const domainExplanationIdentityPath = new URL(
  "../services/domain/operationalFindingsExplanationIdentity.ts",
  import.meta.url
);
const recommendedActionEditIdentityPath = new URL(
  "../services/domain/dailyBriefRecommendedActionEditIdentity.ts",
  import.meta.url
);

const explanation =
  "Chicken Breast has less than one service day of projected coverage.";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005YJ pins Daily Brief Board finding.explanation to ASCII C", () => {
  assert.match(identitySource, /MISE-005YJ/);
  assert.match(boardSource, /MISE-005YJ/);

  assert.match(
    identitySource,
    /export function canonicalDailyBriefBoardExplanation\(value: string\) \{\s*return value\s*\.replace\(\/\\u00a0\/g, " "\)/
  );

  assert.match(
    boardSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationDailyBriefBoardExplanationIdentity"/
  );
  assert.match(boardSource, /normalizeDailyBriefBoardExplanation\(/);
  assert.match(
    boardSource,
    /normalizeDailyBriefBoardExplanation\(finding\.explanation\)\s*\|\|\s*t\("dailyBrief\.explanation\.none"\)/
  );
  assert.doesNotMatch(
    boardSource,
    /<Text style=\{styles\.cardBody\}>\{finding\.explanation\}<\/Text>/
  );

  assert.match(
    catalogSource,
    /"dailyBrief\.explanation\.none": "Review the finding explanation"/
  );
  assert.match(
    catalogSource,
    /"dailyBrief\.explanation\.none": "Revisa la explicación del hallazgo"/
  );
  assert.match(catalogSource, /"dailyBrief\.explanation\.none": "查看发现说明"/);

  // Leave Board title / recommendedAction / annotation as raw pass-through on this tip.
  assert.match(boardSource, /\{finding\.title\}/);
  assert.match(boardSource, /\{finding\.recommendedAction\}/);
  assert.match(boardSource, /\{finding\.managerFeedback\.effectiveRecommendedAction\}/);

  // Leave domain explanation tip path alone (#921 owns that module).
  assert.doesNotMatch(boardSource, /operationalFindingsExplanationIdentity/);
  assert.doesNotMatch(boardSource, /boundedCanonicalOperationalFindingsExplanation/);
  assert.match(findingsSource, /function boundedText\(/);
  assert.equal(
    (() => {
      try {
        readFileSync(domainExplanationIdentityPath, "utf8");
        return "present";
      } catch {
        return "absent";
      }
    })(),
    "absent"
  );
  assert.equal(
    (() => {
      try {
        readFileSync(recommendedActionEditIdentityPath, "utf8");
        return "present";
      } catch {
        return "absent";
      }
    })(),
    "absent"
  );

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /operationalFindingsExplanationIdentity/);
  assert.doesNotMatch(identityCode, /dailyBriefRecommendedActionEditIdentity/);
  assert.doesNotMatch(identityCode, /operationalFindingRecommendedActionIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeApprovalsRecommendedActionIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeDailyBriefBoardExplanation(explanation), explanation);
  assert.equal(normalizeDailyBriefBoardExplanation(` ${explanation} `), explanation);
  assert.equal(
    normalizeDailyBriefBoardExplanation(`Cobertura: ${explanation}`),
    `Cobertura: ${explanation}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Daily Brief Board explanations", () => {
  const padded = `${em}${explanation}${em}`;
  const nbspExplanation = `${nbsp}${explanation}${nbsp}`;
  const internalEm = `Chicken${em}Breast coverage is thin.`;
  const internalNbsp = `Chicken${nbsp}Breast coverage is thin.`;
  const multiline = `Chicken Breast coverage is thin.\nOrder before lunch.`;

  // Inventing proof: Unicode trim would invent the clean explanation.
  assert.equal(padded.trim(), explanation);
  assert.equal(nbspExplanation.trim(), explanation);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspExplanation), true);

  // ASCII C prep refuses that inventing equality for em-space padding.
  assert.equal(canonicalDailyBriefBoardExplanation(padded), padded);
  assert.equal(normalizeDailyBriefBoardExplanation(padded), null);
  assert.equal(normalizeDailyBriefBoardExplanation(padded) || "FALLBACK", "FALLBACK");

  // End NBSP folds to plain space then C-trims to the clean explanation (durable
  // fold). Em-space end padding soft-nulls so display cannot invent equality.
  assert.equal(normalizeDailyBriefBoardExplanation(nbspExplanation), explanation);

  // Internal Unicode spaces: em-space preserved; NBSP folded to plain space.
  assert.equal(normalizeDailyBriefBoardExplanation(internalEm), internalEm);
  assert.equal(
    normalizeDailyBriefBoardExplanation(internalNbsp),
    "Chicken Breast coverage is thin."
  );
  assert.equal(normalizeDailyBriefBoardExplanation(multiline), multiline);
});

test("soft empty, controls, and non-strings fail closed for Daily Brief Board explanations", () => {
  assert.equal(normalizeDailyBriefBoardExplanation(undefined), null);
  assert.equal(normalizeDailyBriefBoardExplanation(null), null);
  assert.equal(normalizeDailyBriefBoardExplanation(""), null);
  assert.equal(normalizeDailyBriefBoardExplanation("   "), null);
  assert.equal(normalizeDailyBriefBoardExplanation(123 as unknown as string), null);
  assert.equal(normalizeDailyBriefBoardExplanation(`\u0001${explanation}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeDailyBriefBoardExplanation(`${explanation}\t`), explanation);
  assert.equal(normalizeDailyBriefBoardExplanation(`${explanation}\u0007`), null);
  assert.equal(normalizeDailyBriefBoardExplanation(em), null);
  // Internal LF/TAB/CR remain allowed (operator_note multiline allowlist).
  assert.equal(
    normalizeDailyBriefBoardExplanation(`Chicken Breast\tcoverage is thin.`),
    `Chicken Breast\tcoverage is thin.`
  );
});

test("Daily Brief Board bypass proof: empty and Unicode-only-space explanations soft-null to localized none", () => {
  // Prior always-pass-explanation path still rendered blank-looking cardBody Text.
  assert.equal(normalizeDailyBriefBoardExplanation(""), null);
  assert.equal(normalizeDailyBriefBoardExplanation(em), null);
  assert.equal(normalizeDailyBriefBoardExplanation(nbsp), null);
  assert.match(
    boardSource,
    /normalizeDailyBriefBoardExplanation\(finding\.explanation\)\s*\|\|\s*t\("dailyBrief\.explanation\.none"\)/
  );
});

test("Daily Brief Board explanation identity refuses Unicode inventing equality", () => {
  const padded = `${em}${explanation}${em}`;
  assert.notEqual(canonicalDailyBriefBoardExplanation(padded), padded.trim());
  assert.equal(normalizeDailyBriefBoardExplanation(padded), null);
  assert.equal(normalizeDailyBriefBoardExplanation(`\t${explanation}\n`), explanation);
});

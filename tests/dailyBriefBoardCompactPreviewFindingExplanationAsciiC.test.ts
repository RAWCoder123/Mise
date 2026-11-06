import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalDailyBriefBoardCompactPreviewFindingExplanation,
  normalizeDailyBriefBoardCompactPreviewFindingExplanation
} from "../services/domain/presentationDailyBriefBoardCompactPreviewFindingExplanationIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationDailyBriefBoardCompactPreviewFindingExplanationIdentity.ts",
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
const domainExplanationIdentityPath = new URL(
  "../services/domain/operationalFindingsExplanationIdentity.ts",
  import.meta.url
);
const boardExplanationIdentityPath = new URL(
  "../services/domain/presentationDailyBriefBoardExplanationIdentity.ts",
  import.meta.url
);
const compactPreviewTitleIdentityPath = new URL(
  "../services/domain/presentationDailyBriefBoardCompactPreviewFindingTitleIdentity.ts",
  import.meta.url
);
const boardFindingTitleIdentityPath = new URL(
  "../services/domain/presentationDailyBriefBoardFindingTitleIdentity.ts",
  import.meta.url
);
const boardRecommendedActionIdentityPath = new URL(
  "../services/domain/presentationDailyBriefBoardRecommendedActionIdentity.ts",
  import.meta.url
);

const explanation =
  "Chicken Breast has less than one service day of projected coverage.";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005YO pins Daily Brief Board compact-preview firstFinding.explanation to ASCII C", () => {
  assert.match(identitySource, /MISE-005YO/);
  assert.match(boardSource, /MISE-005YO/);

  assert.match(
    identitySource,
    /export function canonicalDailyBriefBoardCompactPreviewFindingExplanation\(value: string\) \{\s*return value\s*\.replace\(\/\\u00a0\/g, " "\)/
  );

  assert.match(
    boardSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationDailyBriefBoardCompactPreviewFindingExplanationIdentity"/
  );
  assert.match(boardSource, /normalizeDailyBriefBoardCompactPreviewFindingExplanation\(/);
  assert.match(
    boardSource,
    /normalizeDailyBriefBoardCompactPreviewFindingExplanation\(\s*firstFinding\.explanation\s*\)\s*\|\|\s*t\("dailyBrief\.compactPreview\.findingExplanation\.none"\)/
  );
  assert.doesNotMatch(boardSource, />\s*\{firstFinding\.explanation\}\s*<\/Text>/);

  assert.match(
    catalogSource,
    /"dailyBrief\.compactPreview\.findingExplanation\.none": "Review the finding explanation"/
  );
  assert.match(
    catalogSource,
    /"dailyBrief\.compactPreview\.findingExplanation\.none": "Revisa la explicación del hallazgo"/
  );
  assert.match(
    catalogSource,
    /"dailyBrief\.compactPreview\.findingExplanation\.none": "查看发现说明"/
  );

  // Leave compact preview title and Board card fields as raw pass-through.
  assert.match(boardSource, />\s*\{firstFinding\.title\}\s*<\/Text>/);
  assert.match(boardSource, />\s*\{finding\.title\}\s*<\/Text>/);
  assert.match(boardSource, /\{finding\.explanation\}/);
  assert.match(boardSource, /\{finding\.recommendedAction\}/);
  assert.match(boardSource, /\{finding\.managerFeedback\.effectiveRecommendedAction\}/);
  assert.match(boardSource, /accessibilityLabel=\{`\$\{finding\.title\}\. \$\{severityLabel\}`\}/);
  assert.match(boardSource, /dailyBrief\.approveAccessibility", \{ title: finding\.title \}/);

  // Leave sibling explanation / title tips alone (#921 / #1142 / #1146 / #1145).
  assert.doesNotMatch(boardSource, /presentationDailyBriefBoardExplanationIdentity/);
  assert.doesNotMatch(boardSource, /normalizeDailyBriefBoardExplanation\(/);
  assert.doesNotMatch(boardSource, /presentationDailyBriefBoardCompactPreviewFindingTitleIdentity/);
  assert.doesNotMatch(boardSource, /normalizeDailyBriefBoardCompactPreviewFindingTitle\(/);
  assert.doesNotMatch(boardSource, /presentationDailyBriefBoardFindingTitleIdentity/);
  assert.doesNotMatch(boardSource, /normalizeDailyBriefBoardFindingTitle\(/);
  assert.doesNotMatch(boardSource, /operationalFindingsExplanationIdentity/);
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
        readFileSync(boardExplanationIdentityPath, "utf8");
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
        readFileSync(compactPreviewTitleIdentityPath, "utf8");
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
        readFileSync(boardFindingTitleIdentityPath, "utf8");
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
        readFileSync(boardRecommendedActionIdentityPath, "utf8");
        return "present";
      } catch {
        return "absent";
      }
    })(),
    "absent"
  );

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationDailyBriefBoardExplanationIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyBriefBoardCompactPreviewFindingTitleIdentity/);
  assert.doesNotMatch(identityCode, /operationalFindingsExplanationIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyBriefBoardRecommendedActionIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingExplanation(explanation), explanation);
  assert.equal(
    normalizeDailyBriefBoardCompactPreviewFindingExplanation(` ${explanation} `),
    explanation
  );
  assert.equal(
    normalizeDailyBriefBoardCompactPreviewFindingExplanation(`Cobertura: ${explanation}`),
    `Cobertura: ${explanation}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for compact-preview finding explanations", () => {
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
  assert.equal(canonicalDailyBriefBoardCompactPreviewFindingExplanation(padded), padded);
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingExplanation(padded), null);
  assert.equal(
    normalizeDailyBriefBoardCompactPreviewFindingExplanation(padded) || "FALLBACK",
    "FALLBACK"
  );

  // End NBSP folds to plain space then C-trims to the clean explanation (durable
  // fold). Em-space end padding soft-nulls so display cannot invent equality.
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingExplanation(nbspExplanation), explanation);

  // Internal Unicode spaces: em-space preserved; NBSP folded to plain space.
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingExplanation(internalEm), internalEm);
  assert.equal(
    normalizeDailyBriefBoardCompactPreviewFindingExplanation(internalNbsp),
    "Chicken Breast coverage is thin."
  );
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingExplanation(multiline), multiline);
});

test("soft empty, controls, and non-strings fail closed for compact-preview finding explanations", () => {
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingExplanation(undefined), null);
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingExplanation(null), null);
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingExplanation(""), null);
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingExplanation("   "), null);
  assert.equal(
    normalizeDailyBriefBoardCompactPreviewFindingExplanation(123 as unknown as string),
    null
  );
  assert.equal(
    normalizeDailyBriefBoardCompactPreviewFindingExplanation(`\u0001${explanation}`),
    null
  );
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(
    normalizeDailyBriefBoardCompactPreviewFindingExplanation(`${explanation}\t`),
    explanation
  );
  assert.equal(
    normalizeDailyBriefBoardCompactPreviewFindingExplanation(`${explanation}\u0007`),
    null
  );
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingExplanation(em), null);
  // Internal LF/TAB/CR remain allowed (operator_note multiline allowlist).
  assert.equal(
    normalizeDailyBriefBoardCompactPreviewFindingExplanation(`Chicken Breast\tcoverage is thin.`),
    `Chicken Breast\tcoverage is thin.`
  );
});

test("Daily Brief Board compact-preview bypass proof: empty and Unicode-only-space explanations soft-null to localized none", () => {
  // Prior always-pass-explanation path still rendered blank-looking previewBody Text.
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingExplanation(""), null);
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingExplanation(em), null);
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingExplanation(nbsp), null);
  assert.match(
    boardSource,
    /normalizeDailyBriefBoardCompactPreviewFindingExplanation\(\s*firstFinding\.explanation\s*\)\s*\|\|\s*t\("dailyBrief\.compactPreview\.findingExplanation\.none"\)/
  );
});

test("Daily Brief Board compact-preview finding explanation identity refuses Unicode inventing equality", () => {
  const padded = `${em}${explanation}${em}`;
  assert.notEqual(
    canonicalDailyBriefBoardCompactPreviewFindingExplanation(padded),
    padded.trim()
  );
  assert.equal(normalizeDailyBriefBoardCompactPreviewFindingExplanation(padded), null);
  assert.equal(
    normalizeDailyBriefBoardCompactPreviewFindingExplanation(`\t${explanation}\n`),
    explanation
  );
});

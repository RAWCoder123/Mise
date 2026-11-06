import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalDailyBriefBoardEffectiveRecommendedAction,
  normalizeDailyBriefBoardEffectiveRecommendedAction
} from "../services/domain/presentationDailyBriefBoardEffectiveRecommendedActionIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationDailyBriefBoardEffectiveRecommendedActionIdentity.ts",
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
const domainRecommendedActionIdentityPath = new URL(
  "../services/domain/operationalFindingRecommendedActionIdentity.ts",
  import.meta.url
);
const recommendedActionEditIdentityPath = new URL(
  "../services/domain/dailyBriefRecommendedActionEditIdentity.ts",
  import.meta.url
);
const boardRecommendedActionIdentityPath = new URL(
  "../services/domain/presentationDailyBriefBoardRecommendedActionIdentity.ts",
  import.meta.url
);
const boardExplanationIdentityPath = new URL(
  "../services/domain/presentationDailyBriefBoardExplanationIdentity.ts",
  import.meta.url
);

const annotation = "Count basil before dinner service";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005YL pins Daily Brief Board effectiveRecommendedAction to ASCII C", () => {
  assert.match(identitySource, /MISE-005YL/);
  assert.match(boardSource, /MISE-005YL/);

  assert.match(
    identitySource,
    /export function canonicalDailyBriefBoardEffectiveRecommendedAction\(value: string\) \{\s*return value\s*\.replace\(\/\\u00a0\/g, " "\)/
  );

  assert.match(
    boardSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationDailyBriefBoardEffectiveRecommendedActionIdentity"/
  );
  assert.match(boardSource, /normalizeDailyBriefBoardEffectiveRecommendedAction\(/);
  assert.match(
    boardSource,
    /normalizeDailyBriefBoardEffectiveRecommendedAction\(\s*finding\.managerFeedback\.effectiveRecommendedAction\s*\)\s*\|\|\s*t\("dailyBrief\.feedback\.effectiveRecommendedAction\.none"\)/
  );
  assert.doesNotMatch(
    boardSource,
    /<Text style=\{styles\.annotation\}>\{finding\.managerFeedback\.effectiveRecommendedAction\}<\/Text>/
  );

  assert.match(
    catalogSource,
    /"dailyBrief\.feedback\.effectiveRecommendedAction\.none": "Review the manager note"/
  );
  assert.match(
    catalogSource,
    /"dailyBrief\.feedback\.effectiveRecommendedAction\.none": "Revisa la nota del gerente"/
  );
  assert.match(
    catalogSource,
    /"dailyBrief\.feedback\.effectiveRecommendedAction\.none": "查看经理批注"/
  );

  // Leave Board title / explanation / recommendedAction as raw pass-through on this tip.
  assert.match(boardSource, /\{finding\.title\}/);
  assert.match(boardSource, /\{finding\.explanation\}/);
  assert.match(boardSource, /\{finding\.recommendedAction\}/);

  // Leave domain recommendedAction / edit / Board recommendedAction / Board explanation tip paths alone.
  assert.doesNotMatch(boardSource, /operationalFindingRecommendedActionIdentity/);
  assert.doesNotMatch(boardSource, /dailyBriefRecommendedActionEditIdentity/);
  assert.doesNotMatch(boardSource, /normalizeDailyBriefBoardRecommendedAction/);
  assert.doesNotMatch(boardSource, /presentationDailyBriefBoardRecommendedActionIdentity/);
  assert.doesNotMatch(boardSource, /normalizeDailyBriefBoardExplanation/);
  assert.doesNotMatch(boardSource, /presentationDailyBriefBoardExplanationIdentity/);
  assert.match(findingsSource, /function boundedText\(/);
  assert.equal(
    (() => {
      try {
        readFileSync(domainRecommendedActionIdentityPath, "utf8");
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

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /operationalFindingRecommendedActionIdentity/);
  assert.doesNotMatch(identityCode, /dailyBriefRecommendedActionEditIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyBriefBoardRecommendedActionIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyBriefBoardExplanationIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeApprovalsRecommendedActionIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeDailyBriefBoardEffectiveRecommendedAction(annotation), annotation);
  assert.equal(
    normalizeDailyBriefBoardEffectiveRecommendedAction(` ${annotation} `),
    annotation
  );
  assert.equal(
    normalizeDailyBriefBoardEffectiveRecommendedAction(`Contar ${annotation}`),
    `Contar ${annotation}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Daily Brief Board annotations", () => {
  const padded = `${em}${annotation}${em}`;
  const nbspAction = `${nbsp}${annotation}${nbsp}`;
  const internalEm = `Count${em}basil before dinner service`;
  const internalNbsp = `Count${nbsp}basil before dinner service`;
  const multiline = `Count basil\nbefore dinner service`;

  // Inventing proof: Unicode trim would invent the clean annotation.
  assert.equal(padded.trim(), annotation);
  assert.equal(nbspAction.trim(), annotation);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspAction), true);

  // ASCII C prep refuses that inventing equality for em-space padding.
  assert.equal(canonicalDailyBriefBoardEffectiveRecommendedAction(padded), padded);
  assert.equal(normalizeDailyBriefBoardEffectiveRecommendedAction(padded), null);
  assert.equal(normalizeDailyBriefBoardEffectiveRecommendedAction(padded) || "FALLBACK", "FALLBACK");

  // End NBSP folds to plain space then C-trims to the clean annotation (durable
  // fold). Em-space end padding soft-nulls so display cannot invent equality.
  assert.equal(normalizeDailyBriefBoardEffectiveRecommendedAction(nbspAction), annotation);

  // Internal Unicode spaces: em-space preserved; NBSP folded to plain space.
  assert.equal(normalizeDailyBriefBoardEffectiveRecommendedAction(internalEm), internalEm);
  assert.equal(
    normalizeDailyBriefBoardEffectiveRecommendedAction(internalNbsp),
    "Count basil before dinner service"
  );
  assert.equal(normalizeDailyBriefBoardEffectiveRecommendedAction(multiline), multiline);
});

test("soft empty, controls, and non-strings fail closed for Daily Brief Board annotations", () => {
  assert.equal(normalizeDailyBriefBoardEffectiveRecommendedAction(undefined), null);
  assert.equal(normalizeDailyBriefBoardEffectiveRecommendedAction(null), null);
  assert.equal(normalizeDailyBriefBoardEffectiveRecommendedAction(""), null);
  assert.equal(normalizeDailyBriefBoardEffectiveRecommendedAction("   "), null);
  assert.equal(normalizeDailyBriefBoardEffectiveRecommendedAction(123 as unknown as string), null);
  assert.equal(normalizeDailyBriefBoardEffectiveRecommendedAction(`\u0001${annotation}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(
    normalizeDailyBriefBoardEffectiveRecommendedAction(`${annotation}\t`),
    annotation
  );
  assert.equal(normalizeDailyBriefBoardEffectiveRecommendedAction(`${annotation}\u0007`), null);
  assert.equal(normalizeDailyBriefBoardEffectiveRecommendedAction(em), null);
  // Internal LF/TAB/CR remain allowed (operator_note multiline allowlist).
  assert.equal(
    normalizeDailyBriefBoardEffectiveRecommendedAction(`Count basil\tbefore dinner service`),
    `Count basil\tbefore dinner service`
  );
});

test("Daily Brief Board bypass proof: empty and Unicode-only-space annotations soft-null to localized none", () => {
  // Prior always-pass-effectiveRecommendedAction path still rendered blank-looking annotation Text.
  assert.equal(normalizeDailyBriefBoardEffectiveRecommendedAction(""), null);
  assert.equal(normalizeDailyBriefBoardEffectiveRecommendedAction(em), null);
  assert.equal(normalizeDailyBriefBoardEffectiveRecommendedAction(nbsp), null);
  assert.match(
    boardSource,
    /normalizeDailyBriefBoardEffectiveRecommendedAction\(\s*finding\.managerFeedback\.effectiveRecommendedAction\s*\)\s*\|\|\s*t\("dailyBrief\.feedback\.effectiveRecommendedAction\.none"\)/
  );
});

test("Daily Brief Board annotation identity refuses Unicode inventing equality", () => {
  const padded = `${em}${annotation}${em}`;
  assert.notEqual(canonicalDailyBriefBoardEffectiveRecommendedAction(padded), padded.trim());
  assert.equal(normalizeDailyBriefBoardEffectiveRecommendedAction(padded), null);
  assert.equal(
    normalizeDailyBriefBoardEffectiveRecommendedAction(`\t${annotation}\n`),
    annotation
  );
});

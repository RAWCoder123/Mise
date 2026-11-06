import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalDailyBriefBoardRecommendedAction,
  normalizeDailyBriefBoardRecommendedAction
} from "../services/domain/presentationDailyBriefBoardRecommendedActionIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationDailyBriefBoardRecommendedActionIdentity.ts", import.meta.url),
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
const boardExplanationIdentityPath = new URL(
  "../services/domain/presentationDailyBriefBoardExplanationIdentity.ts",
  import.meta.url
);

const recommendedAction = "Order 12 lb from Fresh Produce Co.";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005YK pins Daily Brief Board finding.recommendedAction to ASCII C", () => {
  assert.match(identitySource, /MISE-005YK/);
  assert.match(boardSource, /MISE-005YK/);

  assert.match(
    identitySource,
    /export function canonicalDailyBriefBoardRecommendedAction\(value: string\) \{\s*return value\s*\.replace\(\/\\u00a0\/g, " "\)/
  );

  assert.match(
    boardSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationDailyBriefBoardRecommendedActionIdentity"/
  );
  assert.match(boardSource, /normalizeDailyBriefBoardRecommendedAction\(/);
  assert.match(
    boardSource,
    /normalizeDailyBriefBoardRecommendedAction\(finding\.recommendedAction\)\s*\|\|\s*t\("dailyBrief\.recommendedAction\.none"\)/
  );
  assert.doesNotMatch(
    boardSource,
    /<Text style=\{styles\.recommended\}>\{finding\.recommendedAction\}<\/Text>/
  );

  assert.match(
    catalogSource,
    /"dailyBrief\.recommendedAction\.none": "Review the recommended action"/
  );
  assert.match(
    catalogSource,
    /"dailyBrief\.recommendedAction\.none": "Revisa la acción recomendada"/
  );
  assert.match(catalogSource, /"dailyBrief\.recommendedAction\.none": "查看建议操作"/);

  // Leave Board title / explanation / annotation as raw pass-through on this tip.
  assert.match(boardSource, /\{finding\.title\}/);
  assert.match(boardSource, /\{finding\.explanation\}/);
  assert.match(boardSource, /\{finding\.managerFeedback\.effectiveRecommendedAction\}/);

  // Leave domain recommendedAction / edit / Board explanation tip paths alone.
  assert.doesNotMatch(boardSource, /operationalFindingRecommendedActionIdentity/);
  assert.doesNotMatch(boardSource, /dailyBriefRecommendedActionEditIdentity/);
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
  assert.doesNotMatch(identityCode, /presentationDailyBriefBoardExplanationIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeApprovalsRecommendedActionIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeDailyBriefBoardRecommendedAction(recommendedAction), recommendedAction);
  assert.equal(
    normalizeDailyBriefBoardRecommendedAction(` ${recommendedAction} `),
    recommendedAction
  );
  assert.equal(
    normalizeDailyBriefBoardRecommendedAction(`Pedir ${recommendedAction}`),
    `Pedir ${recommendedAction}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Daily Brief Board recommended actions", () => {
  const padded = `${em}${recommendedAction}${em}`;
  const nbspAction = `${nbsp}${recommendedAction}${nbsp}`;
  const internalEm = `Order${em}12 lb from Fresh Produce Co.`;
  const internalNbsp = `Order${nbsp}12 lb from Fresh Produce Co.`;
  const multiline = `Order 12 lb\nfrom Fresh Produce Co.`;

  // Inventing proof: Unicode trim would invent the clean recommended action.
  assert.equal(padded.trim(), recommendedAction);
  assert.equal(nbspAction.trim(), recommendedAction);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspAction), true);

  // ASCII C prep refuses that inventing equality for em-space padding.
  assert.equal(canonicalDailyBriefBoardRecommendedAction(padded), padded);
  assert.equal(normalizeDailyBriefBoardRecommendedAction(padded), null);
  assert.equal(normalizeDailyBriefBoardRecommendedAction(padded) || "FALLBACK", "FALLBACK");

  // End NBSP folds to plain space then C-trims to the clean action (durable
  // fold). Em-space end padding soft-nulls so display cannot invent equality.
  assert.equal(normalizeDailyBriefBoardRecommendedAction(nbspAction), recommendedAction);

  // Internal Unicode spaces: em-space preserved; NBSP folded to plain space.
  assert.equal(normalizeDailyBriefBoardRecommendedAction(internalEm), internalEm);
  assert.equal(
    normalizeDailyBriefBoardRecommendedAction(internalNbsp),
    "Order 12 lb from Fresh Produce Co."
  );
  assert.equal(normalizeDailyBriefBoardRecommendedAction(multiline), multiline);
});

test("soft empty, controls, and non-strings fail closed for Daily Brief Board recommended actions", () => {
  assert.equal(normalizeDailyBriefBoardRecommendedAction(undefined), null);
  assert.equal(normalizeDailyBriefBoardRecommendedAction(null), null);
  assert.equal(normalizeDailyBriefBoardRecommendedAction(""), null);
  assert.equal(normalizeDailyBriefBoardRecommendedAction("   "), null);
  assert.equal(normalizeDailyBriefBoardRecommendedAction(123 as unknown as string), null);
  assert.equal(normalizeDailyBriefBoardRecommendedAction(`\u0001${recommendedAction}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(
    normalizeDailyBriefBoardRecommendedAction(`${recommendedAction}\t`),
    recommendedAction
  );
  assert.equal(normalizeDailyBriefBoardRecommendedAction(`${recommendedAction}\u0007`), null);
  assert.equal(normalizeDailyBriefBoardRecommendedAction(em), null);
  // Internal LF/TAB/CR remain allowed (operator_note multiline allowlist).
  assert.equal(
    normalizeDailyBriefBoardRecommendedAction(`Order 12 lb\tfrom Fresh Produce Co.`),
    `Order 12 lb\tfrom Fresh Produce Co.`
  );
});

test("Daily Brief Board bypass proof: empty and Unicode-only-space recommended actions soft-null to localized none", () => {
  // Prior always-pass-recommendedAction path still rendered blank-looking recommended Text.
  assert.equal(normalizeDailyBriefBoardRecommendedAction(""), null);
  assert.equal(normalizeDailyBriefBoardRecommendedAction(em), null);
  assert.equal(normalizeDailyBriefBoardRecommendedAction(nbsp), null);
  assert.match(
    boardSource,
    /normalizeDailyBriefBoardRecommendedAction\(finding\.recommendedAction\)\s*\|\|\s*t\("dailyBrief\.recommendedAction\.none"\)/
  );
});

test("Daily Brief Board recommended-action identity refuses Unicode inventing equality", () => {
  const padded = `${em}${recommendedAction}${em}`;
  assert.notEqual(canonicalDailyBriefBoardRecommendedAction(padded), padded.trim());
  assert.equal(normalizeDailyBriefBoardRecommendedAction(padded), null);
  assert.equal(
    normalizeDailyBriefBoardRecommendedAction(`\t${recommendedAction}\n`),
    recommendedAction
  );
});

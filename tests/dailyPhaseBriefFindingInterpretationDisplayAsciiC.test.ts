import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalDailyPhaseBriefFindingInterpretationDisplay,
  normalizeDailyPhaseBriefFindingInterpretationDisplay
} from "../services/domain/presentationDailyPhaseBriefFindingInterpretationDisplayIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationDailyPhaseBriefFindingInterpretationDisplayIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const dailyBriefSource = readFileSync(
  new URL("../app/more/daily-brief.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const boardSource = readFileSync(
  new URL("../components/dailyBrief/DailyBriefBoard.tsx", import.meta.url),
  "utf8"
);
const phaseInterpretationA11yIdentityPath = new URL(
  "../services/domain/presentationDailyPhaseBriefFindingInterpretationIdentity.ts",
  import.meta.url
);
const phaseTitleDisplayIdentityPath = new URL(
  "../services/domain/presentationDailyPhaseBriefFindingTitleDisplayIdentity.ts",
  import.meta.url
);
const phaseTitleA11yIdentityPath = new URL(
  "../services/domain/presentationDailyPhaseBriefFindingTitleIdentity.ts",
  import.meta.url
);
const boardExplanationIdentityPath = new URL(
  "../services/domain/presentationDailyBriefBoardExplanationIdentity.ts",
  import.meta.url
);
const boardFindingTitleIdentityPath = new URL(
  "../services/domain/presentationDailyBriefBoardFindingTitleIdentity.ts",
  import.meta.url
);

const interpretation = "Low stock before lunch";
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

test("MISE-005YY pins Daily Phase Brief FindingRow finding.interpretation display to ASCII C", () => {
  assert.match(identitySource, /MISE-005YY/);
  assert.match(dailyBriefSource, /MISE-005YY/);

  assert.match(
    identitySource,
    /export function canonicalDailyPhaseBriefFindingInterpretationDisplay\(value: string\) \{\s*return value\s*\.replace\(\/\\u00a0\/g, " "\)/
  );

  assert.match(
    dailyBriefSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationDailyPhaseBriefFindingInterpretationDisplayIdentity"/
  );
  assert.match(dailyBriefSource, /normalizeDailyPhaseBriefFindingInterpretationDisplay\(/);
  assert.match(
    dailyBriefSource,
    /normalizeDailyPhaseBriefFindingInterpretationDisplay\(finding\.interpretation\)\s*\|\|\s*t\("dailyPhaseBrief\.findingInterpretation\.none"\)/
  );
  assert.doesNotMatch(
    dailyBriefSource,
    /styles\.findingBody\}>\s*\{finding\.interpretation\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"dailyPhaseBrief\.findingInterpretation\.none": "Details"/);
  assert.match(catalogSource, /"dailyPhaseBrief\.findingInterpretation\.none": "Detalles"/);
  assert.match(catalogSource, /"dailyPhaseBrief\.findingInterpretation\.none": "详情"/);

  // Leave finding-row a11y title / interpretation interpolations as raw
  // pass-through on this tip (owned by #1076 / #1085).
  assert.match(
    dailyBriefSource,
    /accessibilityLabel=\{`\$\{finding\.title\}\. \$\{finding\.interpretation\}`\}/
  );
  // Leave finding.title display Text alone.
  assert.match(dailyBriefSource, /styles\.findingTitle\}>\{finding\.title\}<\/Text>/);

  // Leave sibling Board / a11y interpretation / title tips alone.
  assert.doesNotMatch(
    dailyBriefSource,
    /presentationDailyPhaseBriefFindingInterpretationIdentity/
  );
  assert.doesNotMatch(dailyBriefSource, /normalizeDailyPhaseBriefFindingInterpretation\(/);
  assert.doesNotMatch(
    dailyBriefSource,
    /presentationDailyPhaseBriefFindingTitleDisplayIdentity/
  );
  assert.doesNotMatch(dailyBriefSource, /presentationDailyBriefBoardExplanationIdentity/);
  assert.doesNotMatch(
    boardSource,
    /presentationDailyPhaseBriefFindingInterpretationDisplayIdentity/
  );
  assert.equal(filePresence(phaseInterpretationA11yIdentityPath), "absent");
  assert.equal(filePresence(phaseTitleDisplayIdentityPath), "absent");
  assert.equal(filePresence(phaseTitleA11yIdentityPath), "absent");
  assert.equal(filePresence(boardExplanationIdentityPath), "absent");
  assert.equal(filePresence(boardFindingTitleIdentityPath), "absent");

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(
    identityCode,
    /presentationDailyPhaseBriefFindingInterpretationIdentity/
  );
  assert.doesNotMatch(identityCode, /presentationDailyPhaseBriefFindingTitleDisplayIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyPhaseBriefFindingTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyBriefBoardExplanationIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyBriefBoardFindingTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(
    normalizeDailyPhaseBriefFindingInterpretationDisplay(interpretation),
    interpretation
  );
  assert.equal(
    normalizeDailyPhaseBriefFindingInterpretationDisplay(` ${interpretation} `),
    interpretation
  );
  assert.equal(
    normalizeDailyPhaseBriefFindingInterpretationDisplay(`Case-${interpretation}`),
    `Case-${interpretation}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Daily Phase Brief FindingRow finding interpretations", () => {
  const padded = `${em}${interpretation}${em}`;
  const nbspInterpretation = `${nbsp}${interpretation}${nbsp}`;
  const internalEm = `Low${em}stock before lunch`;
  const internalNbsp = `Low${nbsp}stock before lunch`;
  const multiline = `Low stock before lunch.\nCount produce before prep.`;

  // Inventing proof: Unicode trim would invent the clean finding interpretation.
  assert.equal(padded.trim(), interpretation);
  assert.equal(nbspInterpretation.trim(), interpretation);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspInterpretation), true);
  // Blank-body bypass proof: Unicode-only space is truthy and previously still
  // rendered as the findingBody Text.
  assert.equal(Boolean(em), true);

  // ASCII C prep refuses that inventing equality for em-space padding.
  assert.equal(canonicalDailyPhaseBriefFindingInterpretationDisplay(padded), padded);
  assert.equal(normalizeDailyPhaseBriefFindingInterpretationDisplay(padded), null);
  assert.equal(
    normalizeDailyPhaseBriefFindingInterpretationDisplay(padded) || "FALLBACK",
    "FALLBACK"
  );

  // End NBSP folds to plain space then C-trims to the clean interpretation
  // (durable fold). Em-space end padding soft-nulls so display cannot invent
  // equality.
  assert.equal(
    normalizeDailyPhaseBriefFindingInterpretationDisplay(nbspInterpretation),
    interpretation
  );

  // Internal Unicode spaces: em-space preserved; NBSP folded to plain space.
  assert.equal(normalizeDailyPhaseBriefFindingInterpretationDisplay(internalEm), internalEm);
  assert.equal(
    normalizeDailyPhaseBriefFindingInterpretationDisplay(internalNbsp),
    "Low stock before lunch"
  );
  assert.equal(normalizeDailyPhaseBriefFindingInterpretationDisplay(multiline), multiline);
});

test("soft empty, controls, and non-strings fail closed for Daily Phase Brief FindingRow finding interpretations", () => {
  assert.equal(normalizeDailyPhaseBriefFindingInterpretationDisplay(undefined), null);
  assert.equal(normalizeDailyPhaseBriefFindingInterpretationDisplay(null), null);
  assert.equal(normalizeDailyPhaseBriefFindingInterpretationDisplay(""), null);
  assert.equal(normalizeDailyPhaseBriefFindingInterpretationDisplay("   "), null);
  assert.equal(
    normalizeDailyPhaseBriefFindingInterpretationDisplay(123 as unknown as string),
    null
  );
  assert.equal(
    normalizeDailyPhaseBriefFindingInterpretationDisplay(`\u0001${interpretation}`),
    null
  );
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(
    normalizeDailyPhaseBriefFindingInterpretationDisplay(`${interpretation}\t`),
    interpretation
  );
  assert.equal(
    normalizeDailyPhaseBriefFindingInterpretationDisplay(`${interpretation}\u0007`),
    null
  );
  assert.equal(normalizeDailyPhaseBriefFindingInterpretationDisplay(em), null);
  // Internal LF/TAB/CR remain allowed (operator_note multiline allowlist).
  assert.equal(
    normalizeDailyPhaseBriefFindingInterpretationDisplay(`Low stock\tbefore lunch`),
    `Low stock\tbefore lunch`
  );
  assert.equal(
    normalizeDailyPhaseBriefFindingInterpretationDisplay(`Low stock\nbefore lunch`),
    `Low stock\nbefore lunch`
  );
});

test("Daily Phase Brief FindingRow bypass proof: empty and Unicode-only-space interpretations soft-null to localized none", () => {
  // Prior always-pass-interpretation path still rendered blank-looking findingBody Text.
  assert.equal(normalizeDailyPhaseBriefFindingInterpretationDisplay(""), null);
  assert.equal(normalizeDailyPhaseBriefFindingInterpretationDisplay(em), null);
  assert.equal(normalizeDailyPhaseBriefFindingInterpretationDisplay(nbsp), null);
  assert.match(
    dailyBriefSource,
    /normalizeDailyPhaseBriefFindingInterpretationDisplay\(finding\.interpretation\)\s*\|\|\s*t\("dailyPhaseBrief\.findingInterpretation\.none"\)/
  );
});

test("Daily Phase Brief FindingRow finding.interpretation display identity refuses Unicode inventing equality", () => {
  const padded = `${em}${interpretation}${em}`;
  assert.notEqual(
    canonicalDailyPhaseBriefFindingInterpretationDisplay(padded),
    padded.trim()
  );
  assert.equal(normalizeDailyPhaseBriefFindingInterpretationDisplay(padded), null);
  assert.equal(
    normalizeDailyPhaseBriefFindingInterpretationDisplay(`\t${interpretation}\n`),
    interpretation
  );
});

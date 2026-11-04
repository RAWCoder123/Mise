import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDailyPhaseBriefFindingInterpretation,
  canonicalizeDailyPhaseBriefFindingInterpretation,
  normalizeDailyPhaseBriefFindingInterpretation
} from "../services/domain/presentationDailyPhaseBriefFindingInterpretationIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationDailyPhaseBriefFindingInterpretationIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const screenSource = readFileSync(
  new URL("../app/more/daily-brief.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const interpretation = "Low stock before lunch";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005XY pins Daily Phase Brief finding-row a11y finding.interpretation to ASCII C", () => {
  assert.match(identitySource, /MISE-005XY/);
  assert.match(screenSource, /MISE-005XY/);

  assert.match(
    identitySource,
    /export function asciiTrimDailyPhaseBriefFindingInterpretation\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    screenSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationDailyPhaseBriefFindingInterpretationIdentity"/
  );
  assert.match(screenSource, /normalizeDailyPhaseBriefFindingInterpretation\(/);
  assert.match(
    screenSource,
    /normalizeDailyPhaseBriefFindingInterpretation\(finding\.interpretation\)\s*\|\|\s*t\("dailyPhaseBrief\.finding\.interpretation\.none"\)/
  );
  assert.doesNotMatch(
    screenSource,
    /accessibilityLabel=\{`\$\{finding\.title\}\. \$\{finding\.interpretation\}`\}/
  );

  assert.match(catalogSource, /"dailyPhaseBrief\.finding\.interpretation\.none": "Details"/);
  assert.match(catalogSource, /"dailyPhaseBrief\.finding\.interpretation\.none": "Detalles"/);
  assert.match(catalogSource, /"dailyPhaseBrief\.finding\.interpretation\.none": "详情"/);

  // Leave display Text and finding.title a11y chrome alone.
  assert.match(screenSource, /\{finding\.interpretation\}/);
  assert.match(screenSource, /\$\{finding\.title\}/);
  assert.doesNotMatch(identitySource, /presentationDailyPhaseBriefFindingTitleIdentity/);
  assert.doesNotMatch(identitySource, /presentationDailyBriefCardHeaderTitleIdentity/);
  assert.doesNotMatch(identitySource, /presentationOperatingPlanTaskDetailIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeDailyPhaseBriefFindingInterpretation(interpretation), interpretation);
  assert.equal(
    normalizeDailyPhaseBriefFindingInterpretation(` ${interpretation} `),
    interpretation
  );
  assert.equal(
    normalizeDailyPhaseBriefFindingInterpretation(`Case-${interpretation}`),
    `Case-${interpretation}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Daily Phase Brief finding-row a11y interpretations", () => {
  const padded = `${em}${interpretation}${em}`;
  const nbspInterpretation = `${nbsp}${interpretation}${nbsp}`;
  const internalEm = `Low${em}stock before lunch`;
  const internalNbsp = `Low${nbsp}stock before lunch`;

  // Inventing proof: Unicode trim would invent the clean finding interpretation.
  assert.equal(padded.trim(), interpretation);
  assert.equal(nbspInterpretation.trim(), interpretation);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspInterpretation), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimDailyPhaseBriefFindingInterpretation(padded), padded);
  assert.equal(canonicalizeDailyPhaseBriefFindingInterpretation(padded), null);
  assert.equal(canonicalizeDailyPhaseBriefFindingInterpretation(nbspInterpretation), null);
  assert.equal(normalizeDailyPhaseBriefFindingInterpretation(padded), null);
  assert.equal(normalizeDailyPhaseBriefFindingInterpretation(nbspInterpretation), null);
  assert.equal(normalizeDailyPhaseBriefFindingInterpretation(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeDailyPhaseBriefFindingInterpretation(internalEm), internalEm);
  assert.equal(normalizeDailyPhaseBriefFindingInterpretation(internalNbsp), internalNbsp);
  assert.equal(normalizeDailyPhaseBriefFindingInterpretation(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Daily Phase Brief finding-row a11y interpretations", () => {
  assert.equal(normalizeDailyPhaseBriefFindingInterpretation(undefined), null);
  assert.equal(normalizeDailyPhaseBriefFindingInterpretation(null), null);
  assert.equal(normalizeDailyPhaseBriefFindingInterpretation(""), null);
  assert.equal(normalizeDailyPhaseBriefFindingInterpretation("   "), null);
  assert.equal(normalizeDailyPhaseBriefFindingInterpretation(123 as unknown as string), null);
  assert.equal(normalizeDailyPhaseBriefFindingInterpretation(`\u0001${interpretation}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeDailyPhaseBriefFindingInterpretation(`${interpretation}\t`), interpretation);
  assert.equal(normalizeDailyPhaseBriefFindingInterpretation(`${interpretation}\u0007`), null);
  assert.equal(normalizeDailyPhaseBriefFindingInterpretation(em), null);
});

test("Daily Phase Brief finding-row a11y bypass proof: empty and Unicode-only-space interpretations soft-null to localized none", () => {
  // Prior always-pass path still interpolated blank-looking interpretation into a11y.
  assert.equal(normalizeDailyPhaseBriefFindingInterpretation(""), null);
  assert.equal(normalizeDailyPhaseBriefFindingInterpretation(em), null);
  assert.equal(normalizeDailyPhaseBriefFindingInterpretation(nbsp), null);
  const missingInterpretation: string | null | undefined = undefined;
  const unicodeOnlyInterpretation: string | null | undefined = em;
  assert.equal(missingInterpretation ?? "", "");
  assert.equal(unicodeOnlyInterpretation ?? "", em);
  assert.notEqual(unicodeOnlyInterpretation ?? "", "");
  assert.equal(Boolean(unicodeOnlyInterpretation), true);
  assert.match(
    screenSource,
    /normalizeDailyPhaseBriefFindingInterpretation\(finding\.interpretation\)\s*\|\|\s*t\("dailyPhaseBrief\.finding\.interpretation\.none"\)/
  );
});

test("Daily Phase Brief finding-row a11y finding.interpretation identity refuses Unicode inventing equality", () => {
  const padded = `${em}${interpretation}${em}`;
  assert.notEqual(asciiTrimDailyPhaseBriefFindingInterpretation(padded), padded.trim());
  assert.equal(normalizeDailyPhaseBriefFindingInterpretation(padded), null);
  assert.equal(normalizeDailyPhaseBriefFindingInterpretation(`\t${interpretation}\n`), interpretation);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDailyPhaseBriefFindingTitle,
  canonicalizeDailyPhaseBriefFindingTitle,
  normalizeDailyPhaseBriefFindingTitle
} from "../services/domain/presentationDailyPhaseBriefFindingTitleIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationDailyPhaseBriefFindingTitleIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const screenSource = readFileSync(
  new URL("../app/more/daily-brief.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const title = "Low stock risk";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005XP pins Daily Phase Brief finding-row a11y finding.title to ASCII C", () => {
  assert.match(identitySource, /MISE-005XP/);
  assert.match(screenSource, /MISE-005XP/);

  assert.match(
    identitySource,
    /export function asciiTrimDailyPhaseBriefFindingTitle\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    screenSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationDailyPhaseBriefFindingTitleIdentity"/
  );
  assert.match(screenSource, /normalizeDailyPhaseBriefFindingTitle\(/);
  assert.match(
    screenSource,
    /normalizeDailyPhaseBriefFindingTitle\(finding\.title\)\s*\|\|\s*t\("dailyPhaseBrief\.finding\.title\.none"\)/
  );
  assert.match(
    screenSource,
    /accessibilityLabel=\{`\$\{\s*(?:\/\/[^\n]*\n\s*)*normalizeDailyPhaseBriefFindingTitle\(finding\.title\)\s*\|\|\s*t\("dailyPhaseBrief\.finding\.title\.none"\)\s*\}\. \$\{finding\.interpretation\}`\}/
  );
  assert.doesNotMatch(
    screenSource,
    /accessibilityLabel=\{`\$\{finding\.title\}\. \$\{finding\.interpretation\}`\}/
  );

  assert.match(catalogSource, /"dailyPhaseBrief\.finding\.title\.none": "Finding"/);
  assert.match(catalogSource, /"dailyPhaseBrief\.finding\.title\.none": "Hallazgo"/);
  assert.match(catalogSource, /"dailyPhaseBrief\.finding\.title\.none": "发现"/);

  // Leave finding-row display Text and sibling tipped modules alone.
  assert.match(screenSource, /\{finding\.title\}/);
  assert.doesNotMatch(screenSource, /normalizeDailyBriefCardHeaderTitle/);
  assert.doesNotMatch(screenSource, /normalizeDailyBriefActionTitle/);
  assert.doesNotMatch(identitySource, /presentationDailyBriefCardHeaderTitleIdentity/);
  assert.doesNotMatch(identitySource, /presentationDailyBriefActionTitleIdentity/);
  assert.doesNotMatch(identitySource, /presentationActivityExpandTitleIdentity/);
  assert.doesNotMatch(identitySource, /presentationHomeApprovalsCardTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeDailyPhaseBriefFindingTitle(title), title);
  assert.equal(normalizeDailyPhaseBriefFindingTitle(` ${title} `), title);
  assert.equal(normalizeDailyPhaseBriefFindingTitle(`Case-${title}`), `Case-${title}`);
});

test("Unicode padding invents via trim and is soft-nulled for Daily Phase Brief finding-row a11y titles", () => {
  const padded = `${em}${title}${em}`;
  const nbspTitle = `${nbsp}${title}${nbsp}`;
  const internalEm = `Low${em}stock`;
  const internalNbsp = `Low${nbsp}stock`;

  // Inventing proof: Unicode trim would invent the clean finding title.
  assert.equal(padded.trim(), title);
  assert.equal(nbspTitle.trim(), title);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspTitle), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimDailyPhaseBriefFindingTitle(padded), padded);
  assert.equal(canonicalizeDailyPhaseBriefFindingTitle(padded), null);
  assert.equal(canonicalizeDailyPhaseBriefFindingTitle(nbspTitle), null);
  assert.equal(normalizeDailyPhaseBriefFindingTitle(padded), null);
  assert.equal(normalizeDailyPhaseBriefFindingTitle(nbspTitle), null);
  assert.equal(normalizeDailyPhaseBriefFindingTitle(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeDailyPhaseBriefFindingTitle(internalEm), internalEm);
  assert.equal(normalizeDailyPhaseBriefFindingTitle(internalNbsp), internalNbsp);
  assert.equal(normalizeDailyPhaseBriefFindingTitle(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Daily Phase Brief finding-row a11y titles", () => {
  assert.equal(normalizeDailyPhaseBriefFindingTitle(undefined), null);
  assert.equal(normalizeDailyPhaseBriefFindingTitle(null), null);
  assert.equal(normalizeDailyPhaseBriefFindingTitle(""), null);
  assert.equal(normalizeDailyPhaseBriefFindingTitle("   "), null);
  assert.equal(normalizeDailyPhaseBriefFindingTitle(123 as unknown as string), null);
  assert.equal(normalizeDailyPhaseBriefFindingTitle(`\u0001${title}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeDailyPhaseBriefFindingTitle(`${title}\t`), title);
  assert.equal(normalizeDailyPhaseBriefFindingTitle(`${title}\u0007`), null);
  assert.equal(normalizeDailyPhaseBriefFindingTitle(em), null);
});

test("Daily Phase Brief finding-row a11y bypass proof: empty and Unicode-only-space titles soft-null to localized none", () => {
  // Prior always-pass path still interpolated blank-looking title into a11y.
  assert.equal(normalizeDailyPhaseBriefFindingTitle(""), null);
  assert.equal(normalizeDailyPhaseBriefFindingTitle(em), null);
  assert.equal(normalizeDailyPhaseBriefFindingTitle(nbsp), null);
  const missingTitle: string | null | undefined = undefined;
  const unicodeOnlyTitle: string | null | undefined = em;
  assert.equal(missingTitle ?? "", "");
  assert.equal(unicodeOnlyTitle ?? "", em);
  assert.notEqual(unicodeOnlyTitle ?? "", "");
  assert.equal(Boolean(unicodeOnlyTitle), true);
  assert.match(
    screenSource,
    /normalizeDailyPhaseBriefFindingTitle\(finding\.title\)\s*\|\|\s*t\("dailyPhaseBrief\.finding\.title\.none"\)/
  );
});

test("Daily Phase Brief finding-row a11y finding.title identity refuses Unicode inventing equality", () => {
  const padded = `${em}${title}${em}`;
  assert.notEqual(asciiTrimDailyPhaseBriefFindingTitle(padded), padded.trim());
  assert.equal(normalizeDailyPhaseBriefFindingTitle(padded), null);
  assert.equal(normalizeDailyPhaseBriefFindingTitle(`\t${title}\n`), title);
});

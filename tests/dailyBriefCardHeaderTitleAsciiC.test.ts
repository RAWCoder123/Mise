import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDailyBriefCardHeaderTitle,
  canonicalizeDailyBriefCardHeaderTitle,
  normalizeDailyBriefCardHeaderTitle
} from "../services/domain/presentationDailyBriefCardHeaderTitleIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationDailyBriefCardHeaderTitleIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const boardSource = readFileSync(
  new URL("../components/dailyBrief/DailyBriefBoard.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const title = "Low stock risk";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005XO pins Daily Brief card header a11y finding.title to ASCII C", () => {
  assert.match(identitySource, /MISE-005XO/);
  assert.match(boardSource, /MISE-005XO/);

  assert.match(
    identitySource,
    /export function asciiTrimDailyBriefCardHeaderTitle\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    boardSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationDailyBriefCardHeaderTitleIdentity"/
  );
  assert.match(boardSource, /normalizeDailyBriefCardHeaderTitle\(/);
  assert.match(
    boardSource,
    /normalizeDailyBriefCardHeaderTitle\(finding\.title\)\s*\|\|\s*t\("dailyBrief\.cardHeader\.title\.none"\)/
  );
  assert.match(
    boardSource,
    /accessibilityLabel=\{`\$\{\s*(?:\/\/[^\n]*\n\s*)*normalizeDailyBriefCardHeaderTitle\(finding\.title\)\s*\|\|\s*t\("dailyBrief\.cardHeader\.title\.none"\)\s*\}\. \$\{severityLabel\}`\}/
  );
  assert.doesNotMatch(
    boardSource,
    /accessibilityLabel=\{`\$\{finding\.title\}\. \$\{severityLabel\}`\}/
  );

  assert.match(catalogSource, /"dailyBrief\.cardHeader\.title\.none": "Finding"/);
  assert.match(catalogSource, /"dailyBrief\.cardHeader\.title\.none": "Hallazgo"/);
  assert.match(catalogSource, /"dailyBrief\.cardHeader\.title\.none": "发现"/);

  // Leave card display Text and action a11y (#1074) alone.
  assert.match(boardSource, /\{finding\.title\}/);
  assert.doesNotMatch(boardSource, /normalizeDailyBriefActionTitle/);
  assert.doesNotMatch(identitySource, /presentationDailyBriefActionTitleIdentity/);
  assert.doesNotMatch(identitySource, /presentationActivityExpandTitleIdentity/);
  assert.doesNotMatch(identitySource, /presentationHomeApprovalsCardTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeDailyBriefCardHeaderTitle(title), title);
  assert.equal(normalizeDailyBriefCardHeaderTitle(` ${title} `), title);
  assert.equal(normalizeDailyBriefCardHeaderTitle(`Case-${title}`), `Case-${title}`);
});

test("Unicode padding invents via trim and is soft-nulled for Daily Brief card header a11y titles", () => {
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
  assert.equal(asciiTrimDailyBriefCardHeaderTitle(padded), padded);
  assert.equal(canonicalizeDailyBriefCardHeaderTitle(padded), null);
  assert.equal(canonicalizeDailyBriefCardHeaderTitle(nbspTitle), null);
  assert.equal(normalizeDailyBriefCardHeaderTitle(padded), null);
  assert.equal(normalizeDailyBriefCardHeaderTitle(nbspTitle), null);
  assert.equal(normalizeDailyBriefCardHeaderTitle(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeDailyBriefCardHeaderTitle(internalEm), internalEm);
  assert.equal(normalizeDailyBriefCardHeaderTitle(internalNbsp), internalNbsp);
  assert.equal(normalizeDailyBriefCardHeaderTitle(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Daily Brief card header a11y titles", () => {
  assert.equal(normalizeDailyBriefCardHeaderTitle(undefined), null);
  assert.equal(normalizeDailyBriefCardHeaderTitle(null), null);
  assert.equal(normalizeDailyBriefCardHeaderTitle(""), null);
  assert.equal(normalizeDailyBriefCardHeaderTitle("   "), null);
  assert.equal(normalizeDailyBriefCardHeaderTitle(123 as unknown as string), null);
  assert.equal(normalizeDailyBriefCardHeaderTitle(`\u0001${title}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeDailyBriefCardHeaderTitle(`${title}\t`), title);
  assert.equal(normalizeDailyBriefCardHeaderTitle(`${title}\u0007`), null);
  assert.equal(normalizeDailyBriefCardHeaderTitle(em), null);
});

test("Daily Brief card header a11y bypass proof: empty and Unicode-only-space titles soft-null to localized none", () => {
  // Prior always-pass path still interpolated blank-looking title into a11y.
  assert.equal(normalizeDailyBriefCardHeaderTitle(""), null);
  assert.equal(normalizeDailyBriefCardHeaderTitle(em), null);
  assert.equal(normalizeDailyBriefCardHeaderTitle(nbsp), null);
  const missingTitle: string | null | undefined = undefined;
  const unicodeOnlyTitle: string | null | undefined = em;
  assert.equal(missingTitle ?? "", "");
  assert.equal(unicodeOnlyTitle ?? "", em);
  assert.notEqual(unicodeOnlyTitle ?? "", "");
  assert.equal(Boolean(unicodeOnlyTitle), true);
  assert.match(
    boardSource,
    /normalizeDailyBriefCardHeaderTitle\(finding\.title\)\s*\|\|\s*t\("dailyBrief\.cardHeader\.title\.none"\)/
  );
});

test("Daily Brief card header a11y finding.title identity refuses Unicode inventing equality", () => {
  const padded = `${em}${title}${em}`;
  assert.notEqual(asciiTrimDailyBriefCardHeaderTitle(padded), padded.trim());
  assert.equal(normalizeDailyBriefCardHeaderTitle(padded), null);
  assert.equal(normalizeDailyBriefCardHeaderTitle(`\t${title}\n`), title);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDailyBriefActionTitle,
  canonicalizeDailyBriefActionTitle,
  normalizeDailyBriefActionTitle
} from "../services/domain/presentationDailyBriefActionTitleIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationDailyBriefActionTitleIdentity.ts",
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

test("MISE-005XN pins Daily Brief action a11y finding.title to ASCII C", () => {
  assert.match(identitySource, /MISE-005XN/);
  assert.match(boardSource, /MISE-005XN/);

  assert.match(
    identitySource,
    /export function asciiTrimDailyBriefActionTitle\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    boardSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationDailyBriefActionTitleIdentity"/
  );
  assert.match(boardSource, /normalizeDailyBriefActionTitle\(/);
  assert.match(
    boardSource,
    /normalizeDailyBriefActionTitle\(finding\.title\)\s*\|\|\s*t\("dailyBrief\.action\.title\.none"\)/
  );
  assert.match(
    boardSource,
    /t\("dailyBrief\.approveAccessibility", \{\s*(?:\/\/[^\n]*\n\s*)*title:\s*normalizeDailyBriefActionTitle\(finding\.title\)\s*\|\|\s*t\("dailyBrief\.action\.title\.none"\)\s*\}\)/
  );
  assert.match(
    boardSource,
    /t\("dailyBrief\.editAccessibility", \{\s*(?:\/\/[^\n]*\n\s*)*title:\s*normalizeDailyBriefActionTitle\(finding\.title\)\s*\|\|\s*t\("dailyBrief\.action\.title\.none"\)\s*\}\)/
  );
  assert.match(
    boardSource,
    /t\("dailyBrief\.dismissAccessibility", \{\s*(?:\/\/[^\n]*\n\s*)*title:\s*normalizeDailyBriefActionTitle\(finding\.title\)\s*\|\|\s*t\("dailyBrief\.action\.title\.none"\)\s*\}\)/
  );
  assert.doesNotMatch(
    boardSource,
    /accessibilityLabel=\{t\("dailyBrief\.approveAccessibility", \{ title: finding\.title \}\)/
  );
  assert.doesNotMatch(
    boardSource,
    /accessibilityLabel=\{t\("dailyBrief\.editAccessibility", \{ title: finding\.title \}\)/
  );
  assert.doesNotMatch(
    boardSource,
    /accessibilityLabel=\{t\("dailyBrief\.dismissAccessibility", \{ title: finding\.title \}\)/
  );

  assert.match(catalogSource, /"dailyBrief\.action\.title\.none": "Finding"/);
  assert.match(catalogSource, /"dailyBrief\.action\.title\.none": "Hallazgo"/);
  assert.match(catalogSource, /"dailyBrief\.action\.title\.none": "发现"/);

  // Leave card display Text and header a11y template alone.
  assert.match(boardSource, /\{finding\.title\}/);
  assert.match(
    boardSource,
    /accessibilityLabel=\{`\$\{finding\.title\}\. \$\{severityLabel\}`\}/
  );
  assert.doesNotMatch(boardSource, /normalizeActivityExpandTitle/);
  assert.doesNotMatch(boardSource, /normalizeCreateTaskListRowTitle/);
  assert.doesNotMatch(identitySource, /presentationActivityExpandTitleIdentity/);
  assert.doesNotMatch(identitySource, /presentationHomeApprovalsCardTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeDailyBriefActionTitle(title), title);
  assert.equal(normalizeDailyBriefActionTitle(` ${title} `), title);
  assert.equal(normalizeDailyBriefActionTitle(`Case-${title}`), `Case-${title}`);
});

test("Unicode padding invents via trim and is soft-nulled for Daily Brief action a11y titles", () => {
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
  assert.equal(asciiTrimDailyBriefActionTitle(padded), padded);
  assert.equal(canonicalizeDailyBriefActionTitle(padded), null);
  assert.equal(canonicalizeDailyBriefActionTitle(nbspTitle), null);
  assert.equal(normalizeDailyBriefActionTitle(padded), null);
  assert.equal(normalizeDailyBriefActionTitle(nbspTitle), null);
  assert.equal(normalizeDailyBriefActionTitle(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeDailyBriefActionTitle(internalEm), internalEm);
  assert.equal(normalizeDailyBriefActionTitle(internalNbsp), internalNbsp);
  assert.equal(normalizeDailyBriefActionTitle(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Daily Brief action a11y titles", () => {
  assert.equal(normalizeDailyBriefActionTitle(undefined), null);
  assert.equal(normalizeDailyBriefActionTitle(null), null);
  assert.equal(normalizeDailyBriefActionTitle(""), null);
  assert.equal(normalizeDailyBriefActionTitle("   "), null);
  assert.equal(normalizeDailyBriefActionTitle(123 as unknown as string), null);
  assert.equal(normalizeDailyBriefActionTitle(`\u0001${title}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeDailyBriefActionTitle(`${title}\t`), title);
  assert.equal(normalizeDailyBriefActionTitle(`${title}\u0007`), null);
  assert.equal(normalizeDailyBriefActionTitle(em), null);
});

test("Daily Brief action a11y bypass proof: empty and Unicode-only-space titles soft-null to localized none", () => {
  // Prior always-pass path still interpolated blank-looking title into a11y.
  assert.equal(normalizeDailyBriefActionTitle(""), null);
  assert.equal(normalizeDailyBriefActionTitle(em), null);
  assert.equal(normalizeDailyBriefActionTitle(nbsp), null);
  const missingTitle: string | null | undefined = undefined;
  const unicodeOnlyTitle: string | null | undefined = em;
  assert.equal(missingTitle ?? "", "");
  assert.equal(unicodeOnlyTitle ?? "", em);
  assert.notEqual(unicodeOnlyTitle ?? "", "");
  assert.equal(Boolean(unicodeOnlyTitle), true);
  assert.match(
    boardSource,
    /normalizeDailyBriefActionTitle\(finding\.title\)\s*\|\|\s*t\("dailyBrief\.action\.title\.none"\)/
  );
});

test("Daily Brief action a11y finding.title identity refuses Unicode inventing equality", () => {
  const padded = `${em}${title}${em}`;
  assert.notEqual(asciiTrimDailyBriefActionTitle(padded), padded.trim());
  assert.equal(normalizeDailyBriefActionTitle(padded), null);
  assert.equal(normalizeDailyBriefActionTitle(`\t${title}\n`), title);
});

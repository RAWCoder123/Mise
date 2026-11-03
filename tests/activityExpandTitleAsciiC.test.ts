import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimActivityExpandTitle,
  canonicalizeActivityExpandTitle,
  normalizeActivityExpandTitle
} from "../services/domain/presentationActivityExpandTitleIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationActivityExpandTitleIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const activitySource = readFileSync(
  new URL("../app/more/activity.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const title = "Order approved";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005XK pins Activity expand a11y event.title to ASCII C", () => {
  assert.match(identitySource, /MISE-005XK/);
  assert.match(activitySource, /MISE-005XK/);

  assert.match(
    identitySource,
    /export function asciiTrimActivityExpandTitle\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    activitySource,
    /from "\.\.\/\.\.\/services\/domain\/presentationActivityExpandTitleIdentity"/
  );
  assert.match(activitySource, /normalizeActivityExpandTitle\(/);
  assert.match(
    activitySource,
    /normalizeActivityExpandTitle\(event\.title\)\s*\|\|\s*t\("activity\.expand\.title\.none"\)/
  );
  assert.match(
    activitySource,
    /t\("activity\.expand\.accessibility", \{\s*(?:\/\/[^\n]*\n\s*)*title:\s*normalizeActivityExpandTitle\(event\.title\)\s*\|\|\s*t\("activity\.expand\.title\.none"\)\s*\}\)/
  );
  assert.doesNotMatch(
    activitySource,
    /accessibilityLabel=\{t\("activity\.expand\.accessibility", \{ title: event\.title \}\)/
  );

  assert.match(catalogSource, /"activity\.expand\.title\.none": "Activity"/);
  assert.match(catalogSource, /"activity\.expand\.title\.none": "Actividad"/);
  assert.match(catalogSource, /"activity\.expand\.title\.none": "活动"/);

  // Leave Activity row display Text and subtitle restaurant.name alone.
  assert.match(activitySource, /\{event\.title\}/);
  assert.doesNotMatch(activitySource, /normalizeActivitySubtitleRestaurantName/);
  assert.doesNotMatch(identitySource, /presentationActivitySubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationHomeApprovalsCardTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeActivityExpandTitle(title), title);
  assert.equal(normalizeActivityExpandTitle(` ${title} `), title);
  assert.equal(normalizeActivityExpandTitle(`Case-${title}`), `Case-${title}`);
});

test("Unicode padding invents via trim and is soft-nulled for Activity expand a11y titles", () => {
  const padded = `${em}${title}${em}`;
  const nbspTitle = `${nbsp}${title}${nbsp}`;
  const internalEm = `Order${em}approved`;
  const internalNbsp = `Order${nbsp}approved`;

  // Inventing proof: Unicode trim would invent the clean activity title.
  assert.equal(padded.trim(), title);
  assert.equal(nbspTitle.trim(), title);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspTitle), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimActivityExpandTitle(padded), padded);
  assert.equal(canonicalizeActivityExpandTitle(padded), null);
  assert.equal(canonicalizeActivityExpandTitle(nbspTitle), null);
  assert.equal(normalizeActivityExpandTitle(padded), null);
  assert.equal(normalizeActivityExpandTitle(nbspTitle), null);
  assert.equal(normalizeActivityExpandTitle(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeActivityExpandTitle(internalEm), internalEm);
  assert.equal(normalizeActivityExpandTitle(internalNbsp), internalNbsp);
  assert.equal(normalizeActivityExpandTitle(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Activity expand a11y titles", () => {
  assert.equal(normalizeActivityExpandTitle(undefined), null);
  assert.equal(normalizeActivityExpandTitle(null), null);
  assert.equal(normalizeActivityExpandTitle(""), null);
  assert.equal(normalizeActivityExpandTitle("   "), null);
  assert.equal(normalizeActivityExpandTitle(123 as unknown as string), null);
  assert.equal(normalizeActivityExpandTitle(`\u0001${title}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeActivityExpandTitle(`${title}\t`), title);
  assert.equal(normalizeActivityExpandTitle(`${title}\u0007`), null);
  assert.equal(normalizeActivityExpandTitle(em), null);
});

test("Activity expand a11y bypass proof: empty and Unicode-only-space titles soft-null to localized none", () => {
  // Prior always-pass path still interpolated blank-looking title into a11y.
  assert.equal(normalizeActivityExpandTitle(""), null);
  assert.equal(normalizeActivityExpandTitle(em), null);
  assert.equal(normalizeActivityExpandTitle(nbsp), null);
  const missingTitle: string | null | undefined = undefined;
  const unicodeOnlyTitle: string | null | undefined = em;
  assert.equal(missingTitle ?? "", "");
  assert.equal(unicodeOnlyTitle ?? "", em);
  assert.notEqual(unicodeOnlyTitle ?? "", "");
  assert.equal(Boolean(unicodeOnlyTitle), true);
  assert.match(
    activitySource,
    /normalizeActivityExpandTitle\(event\.title\)\s*\|\|\s*t\("activity\.expand\.title\.none"\)/
  );
});

test("Activity expand a11y event.title identity refuses Unicode inventing equality", () => {
  const padded = `${em}${title}${em}`;
  assert.notEqual(asciiTrimActivityExpandTitle(padded), padded.trim());
  assert.equal(normalizeActivityExpandTitle(padded), null);
  assert.equal(normalizeActivityExpandTitle(`\t${title}\n`), title);
});

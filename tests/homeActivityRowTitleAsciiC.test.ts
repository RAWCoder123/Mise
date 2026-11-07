import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimHomeActivityRowTitle,
  canonicalizeHomeActivityRowTitle,
  normalizeHomeActivityRowTitle
} from "../services/domain/presentationHomeActivityRowTitleIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationHomeActivityRowTitleIdentity.ts", import.meta.url),
  "utf8"
);
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const activitySource = readFileSync(
  new URL("../app/more/activity.tsx", import.meta.url),
  "utf8"
);
const activityRowTitleIdentityPath = new URL(
  "../services/domain/presentationActivityRowTitleIdentity.ts",
  import.meta.url
);

const title = "Order approved";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005YQ pins Home ActivityRow event.title to ASCII C", () => {
  assert.match(identitySource, /MISE-005YQ/);
  assert.match(homeSource, /MISE-005YQ/);

  assert.match(
    identitySource,
    /export function asciiTrimHomeActivityRowTitle\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    homeSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationHomeActivityRowTitleIdentity"/
  );
  assert.match(homeSource, /normalizeHomeActivityRowTitle\(/);
  assert.match(
    homeSource,
    /normalizeHomeActivityRowTitle\(event\.title\)\s*\|\|\s*t\("home\.activity\.row\.title\.none"\)/
  );
  assert.doesNotMatch(
    homeSource,
    /activityTitle[^>]*>\s*\{event\.title\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"home\.activity\.row\.title\.none": "Activity update"/);
  assert.match(
    catalogSource,
    /"home\.activity\.row\.title\.none": "Actualización de actividad"/
  );
  assert.match(catalogSource, /"home\.activity\.row\.title\.none": "活动更新"/);

  // Leave Home ActivityRow summary as raw pass-through on this tip.
  assert.match(homeSource, /activitySummary[^>]*>\s*\{event\.summary\}\s*<\/Text>/);

  // Leave Activity hub row title as raw pass-through (#1148 owns that surface).
  assert.match(activitySource, /\{event\.title\}/);
  assert.doesNotMatch(homeSource, /presentationActivityRowTitleIdentity/);
  assert.doesNotMatch(homeSource, /normalizeActivityRowTitle/);
  assert.equal(
    (() => {
      try {
        readFileSync(activityRowTitleIdentityPath, "utf8");
        return "present";
      } catch {
        return "absent";
      }
    })(),
    "absent"
  );

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationActivityRowTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeHomeActivityRowTitle(title), title);
  assert.equal(normalizeHomeActivityRowTitle(` ${title} `), title);
  assert.equal(normalizeHomeActivityRowTitle(`Case-${title}`), `Case-${title}`);
});

test("Unicode padding invents via trim and is soft-nulled for Home ActivityRow titles", () => {
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
  assert.equal(asciiTrimHomeActivityRowTitle(padded), padded);
  assert.equal(canonicalizeHomeActivityRowTitle(padded), null);
  assert.equal(canonicalizeHomeActivityRowTitle(nbspTitle), null);
  assert.equal(normalizeHomeActivityRowTitle(padded), null);
  assert.equal(normalizeHomeActivityRowTitle(nbspTitle), null);
  assert.equal(normalizeHomeActivityRowTitle(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeHomeActivityRowTitle(internalEm), internalEm);
  assert.equal(normalizeHomeActivityRowTitle(internalNbsp), internalNbsp);
  assert.equal(normalizeHomeActivityRowTitle(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Home ActivityRow titles", () => {
  assert.equal(normalizeHomeActivityRowTitle(undefined), null);
  assert.equal(normalizeHomeActivityRowTitle(null), null);
  assert.equal(normalizeHomeActivityRowTitle(""), null);
  assert.equal(normalizeHomeActivityRowTitle("   "), null);
  assert.equal(normalizeHomeActivityRowTitle(123 as unknown as string), null);
  assert.equal(normalizeHomeActivityRowTitle(`\u0001${title}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeHomeActivityRowTitle(`${title}\t`), title);
  assert.equal(normalizeHomeActivityRowTitle(`${title}\u0007`), null);
  assert.equal(normalizeHomeActivityRowTitle(em), null);
  // LF/TAB/CR are rejected for single-line titles (full cntrl; no multiline allowlist).
  assert.equal(normalizeHomeActivityRowTitle(`Order\tapproved`), null);
  assert.equal(normalizeHomeActivityRowTitle(`Order\napproved`), null);
});

test("Home ActivityRow bypass proof: empty and Unicode-only-space titles soft-null to localized none", () => {
  // Prior always-pass-title path still rendered blank-looking title Text.
  assert.equal(normalizeHomeActivityRowTitle(""), null);
  assert.equal(normalizeHomeActivityRowTitle(em), null);
  assert.equal(normalizeHomeActivityRowTitle(nbsp), null);
  assert.match(
    homeSource,
    /normalizeHomeActivityRowTitle\(event\.title\)\s*\|\|\s*t\("home\.activity\.row\.title\.none"\)/
  );
});

test("Home ActivityRow event.title identity refuses Unicode inventing equality", () => {
  const padded = `${em}${title}${em}`;
  assert.notEqual(asciiTrimHomeActivityRowTitle(padded), padded.trim());
  assert.equal(normalizeHomeActivityRowTitle(padded), null);
  assert.equal(normalizeHomeActivityRowTitle(padded) || "Activity update", "Activity update");
});

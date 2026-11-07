import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimActivityRowTitle,
  canonicalizeActivityRowTitle,
  normalizeActivityRowTitle
} from "../services/domain/presentationActivityRowTitleIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationActivityRowTitleIdentity.ts", import.meta.url),
  "utf8"
);
const activitySource = readFileSync(
  new URL("../app/more/activity.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");
const expandTitleIdentityPath = new URL(
  "../services/domain/presentationActivityExpandTitleIdentity.ts",
  import.meta.url
);

const title = "Order approved";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005YP pins Activity row event.title to ASCII C", () => {
  assert.match(identitySource, /MISE-005YP/);
  assert.match(activitySource, /MISE-005YP/);

  assert.match(
    identitySource,
    /export function asciiTrimActivityRowTitle\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    activitySource,
    /from "\.\.\/\.\.\/services\/domain\/presentationActivityRowTitleIdentity"/
  );
  assert.match(activitySource, /normalizeActivityRowTitle\(/);
  assert.match(
    activitySource,
    /normalizeActivityRowTitle\(event\.title\)\s*\|\|\s*t\("activity\.row\.title\.none"\)/
  );
  assert.doesNotMatch(activitySource, />\s*\{event\.title\}\s*<\/Text>/);

  assert.match(catalogSource, /"activity\.row\.title\.none": "Activity update"/);
  assert.match(catalogSource, /"activity\.row\.title\.none": "Actualización de actividad"/);
  assert.match(catalogSource, /"activity\.row\.title\.none": "活动更新"/);

  // Leave expand a11y title interpolation as raw pass-through on this tip.
  assert.match(
    activitySource,
    /activity\.expand\.accessibility", \{\s*title: event\.title\s*\}/
  );

  // Leave summary / category / Home activity title as raw pass-through.
  assert.match(activitySource, /\{event\.summary\}/);
  assert.match(homeSource, /\{event\.title\}/);

  // Leave sibling expand-title tip module alone (#1071).
  assert.doesNotMatch(activitySource, /presentationActivityExpandTitleIdentity/);
  assert.doesNotMatch(activitySource, /normalizeActivityExpandTitle/);
  assert.equal(
    (() => {
      try {
        readFileSync(expandTitleIdentityPath, "utf8");
        return "present";
      } catch {
        return "absent";
      }
    })(),
    "absent"
  );

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationActivityExpandTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeActivityRowTitle(title), title);
  assert.equal(normalizeActivityRowTitle(` ${title} `), title);
  assert.equal(normalizeActivityRowTitle(`Case-${title}`), `Case-${title}`);
});

test("Unicode padding invents via trim and is soft-nulled for Activity row titles", () => {
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
  assert.equal(asciiTrimActivityRowTitle(padded), padded);
  assert.equal(canonicalizeActivityRowTitle(padded), null);
  assert.equal(canonicalizeActivityRowTitle(nbspTitle), null);
  assert.equal(normalizeActivityRowTitle(padded), null);
  assert.equal(normalizeActivityRowTitle(nbspTitle), null);
  assert.equal(normalizeActivityRowTitle(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeActivityRowTitle(internalEm), internalEm);
  assert.equal(normalizeActivityRowTitle(internalNbsp), internalNbsp);
  assert.equal(normalizeActivityRowTitle(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Activity row titles", () => {
  assert.equal(normalizeActivityRowTitle(undefined), null);
  assert.equal(normalizeActivityRowTitle(null), null);
  assert.equal(normalizeActivityRowTitle(""), null);
  assert.equal(normalizeActivityRowTitle("   "), null);
  assert.equal(normalizeActivityRowTitle(123 as unknown as string), null);
  assert.equal(normalizeActivityRowTitle(`\u0001${title}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeActivityRowTitle(`${title}\t`), title);
  assert.equal(normalizeActivityRowTitle(`${title}\u0007`), null);
  assert.equal(normalizeActivityRowTitle(em), null);
  // LF/TAB/CR are rejected for single-line titles (full cntrl; no multiline allowlist).
  assert.equal(normalizeActivityRowTitle(`Order\tapproved`), null);
  assert.equal(normalizeActivityRowTitle(`Order\napproved`), null);
});

test("Activity row bypass proof: empty and Unicode-only-space titles soft-null to localized none", () => {
  // Prior always-pass-title path still rendered blank-looking title Text.
  assert.equal(normalizeActivityRowTitle(""), null);
  assert.equal(normalizeActivityRowTitle(em), null);
  assert.equal(normalizeActivityRowTitle(nbsp), null);
  assert.match(
    activitySource,
    /normalizeActivityRowTitle\(event\.title\)\s*\|\|\s*t\("activity\.row\.title\.none"\)/
  );
});

test("Activity row event.title identity refuses Unicode inventing equality", () => {
  const padded = `${em}${title}${em}`;
  assert.notEqual(asciiTrimActivityRowTitle(padded), padded.trim());
  assert.equal(normalizeActivityRowTitle(padded), null);
  assert.equal(normalizeActivityRowTitle(padded) || "Activity update", "Activity update");
});

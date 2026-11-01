import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimHomeStatusApprovalTitle,
  canonicalizeHomeStatusApprovalTitleToken,
  normalizeHomeStatusApprovalTitle
} from "../services/domain/homeStatusApprovalTitleIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/homeStatusApprovalTitleIdentity.ts", import.meta.url),
  "utf8"
);
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");

const title = "Approve chicken reorder";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005VC pins Home StatusNotice approval title to ASCII C", () => {
  assert.match(identitySource, /MISE-005VC/);
  assert.match(homeSource, /MISE-005VC/);

  assert.match(
    identitySource,
    /export function asciiTrimHomeStatusApprovalTitle\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    homeSource,
    /from "\.\.\/\.\.\/services\/domain\/homeStatusApprovalTitleIdentity"/
  );
  assert.match(homeSource, /normalizeHomeStatusApprovalTitle\(/);
  assert.match(homeSource, /approvalTitle \|\| t\(statusKey\)/);
  assert.doesNotMatch(
    homeSource,
    /primaryApproval\?\.title \|\| t\(statusKey\)/
  );

  // Leave sibling StatusNotice fields and Home greeting tips alone.
  assert.match(homeSource, /brief\.restaurantStatus\.topRisk\?\.trim\(\)/);
  assert.match(
    homeSource,
    /primaryApproval\?\.whyItMatters \?\? brief\.restaurantStatus\.summary/
  );

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationGreetingFirstNameIdentity/);
  assert.doesNotMatch(identityCode, /normalizePresentationGreetingFirstName/);
  assert.doesNotMatch(identityCode, /operatingBriefRestaurant/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Home StatusNotice approval titles stable", () => {
  assert.equal(asciiTrimHomeStatusApprovalTitle(`  ${title}  `), title);
  assert.equal(asciiTrimHomeStatusApprovalTitle(`\t${title}\n`), title);
  assert.equal(canonicalizeHomeStatusApprovalTitleToken(`  ${title}  `), title);
  assert.equal(normalizeHomeStatusApprovalTitle(`  ${title}  `), title);
  assert.equal(normalizeHomeStatusApprovalTitle("Approve Chicken"), "Approve Chicken");
});

test("Unicode-only space cannot bypass the localized Home status fallback", () => {
  const unicodeOnly = `${em}${em}`;
  const nbspOnly = `${nbsp}`;

  // Bypass proof: raw Unicode-only space is truthy and would skip t(statusKey).
  assert.equal(Boolean(unicodeOnly), true);
  assert.equal(Boolean(nbspOnly), true);
  assert.equal(Boolean(unicodeOnly || "FALLBACK"), true);
  assert.notEqual(unicodeOnly || "FALLBACK", "FALLBACK");

  // Soft-null restores the intentional localized status-key fallback.
  assert.equal(normalizeHomeStatusApprovalTitle(unicodeOnly), null);
  assert.equal(normalizeHomeStatusApprovalTitle(nbspOnly), null);
  assert.equal(normalizeHomeStatusApprovalTitle(unicodeOnly) || "FALLBACK", "FALLBACK");
  assert.equal(normalizeHomeStatusApprovalTitle("   ") || "FALLBACK", "FALLBACK");
});

test("Unicode em-space / NBSP padding cannot invent clean Home StatusNotice approval titles", () => {
  const padded = `${em}${title}${em}`;
  const nbspTitle = `${nbsp}${title}${nbsp}`;
  const internalEm = `Approve${em}chicken`;
  const internalNbsp = `Approve${nbsp}chicken`;

  // Inventing proof: Unicode trim would invent the clean approval title.
  assert.equal(padded.trim(), title);
  assert.equal(nbspTitle.trim(), title);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspTitle), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimHomeStatusApprovalTitle(padded), padded);
  assert.equal(canonicalizeHomeStatusApprovalTitleToken(padded), null);
  assert.equal(canonicalizeHomeStatusApprovalTitleToken(nbspTitle), null);
  assert.equal(normalizeHomeStatusApprovalTitle(padded), null);
  assert.equal(normalizeHomeStatusApprovalTitle(nbspTitle), null);
  assert.equal(normalizeHomeStatusApprovalTitle(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeHomeStatusApprovalTitleToken(internalEm), internalEm);
  assert.equal(normalizeHomeStatusApprovalTitle(internalNbsp), internalNbsp);
  assert.equal(normalizeHomeStatusApprovalTitle(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Home StatusNotice approval title", () => {
  assert.equal(normalizeHomeStatusApprovalTitle(undefined), null);
  assert.equal(normalizeHomeStatusApprovalTitle(null), null);
  assert.equal(normalizeHomeStatusApprovalTitle(""), null);
  assert.equal(normalizeHomeStatusApprovalTitle("   "), null);
  assert.equal(normalizeHomeStatusApprovalTitle(123 as unknown as string), null);
  assert.equal(normalizeHomeStatusApprovalTitle(`\u0001${title}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeHomeStatusApprovalTitle(`${title}\t`), title);
  assert.equal(normalizeHomeStatusApprovalTitle(`${title}\u0007`), null);
  assert.equal(normalizeHomeStatusApprovalTitle(em), null);
});

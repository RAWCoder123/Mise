import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalHomeApprovalsWhyItMatters,
  normalizeHomeApprovalsWhyItMatters
} from "../services/domain/presentationHomeApprovalsWhyItMattersIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationHomeApprovalsWhyItMattersIdentity.ts", import.meta.url),
  "utf8"
);
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const titleIdentityPath = new URL(
  "../services/domain/presentationHomeApprovalsCardTitleIdentity.ts",
  import.meta.url
);
const recommendedActionIdentityPath = new URL(
  "../services/domain/presentationHomeApprovalsRecommendedActionIdentity.ts",
  import.meta.url
);

const whyItMatters = "Lunch usage was 24% above forecast.";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005YC pins Home ApprovalsSection card.whyItMatters to ASCII C", () => {
  assert.match(identitySource, /MISE-005YC/);
  assert.match(homeSource, /MISE-005YC/);

  assert.match(
    identitySource,
    /export function canonicalHomeApprovalsWhyItMatters\(value: string\) \{\s*return value\s*\.replace\(\/\\u00a0\/g, " "\)/
  );

  assert.match(
    homeSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationHomeApprovalsWhyItMattersIdentity"/
  );
  assert.match(homeSource, /normalizeHomeApprovalsWhyItMatters\(/);
  assert.match(
    homeSource,
    /whyItMatters\s*\|\|\s*t\("home\.approvals\.whyItMatters\.none"\)/
  );
  assert.doesNotMatch(
    homeSource,
    /\{t\("home\.approvals\.why"\)\}: \{card\.whyItMatters\}/
  );

  assert.match(
    catalogSource,
    /"home\.approvals\.whyItMatters\.none": "Review why this decision matters"/
  );
  assert.match(
    catalogSource,
    /"home\.approvals\.whyItMatters\.none": "Revisa por qué importa esta decisión"/
  );
  assert.match(catalogSource, /"home\.approvals\.whyItMatters\.none": "查看此决定为何重要"/);

  // Leave ApprovalsSection title / recommendedAction as raw pass-through on this tip.
  assert.match(homeSource, /\{card\.title\}/);
  assert.match(homeSource, /\{card\.recommendedAction\}/);

  // Leave StatusNotice primaryApproval?.whyItMatters message pass-through alone.
  assert.match(
    homeSource,
    /primaryApproval\?\.whyItMatters\s*\?\?\s*brief\.restaurantStatus\.summary/
  );

  // Leave Home greeting restaurant.name alone on main (open #1044).
  assert.match(
    homeSource,
    /t\("home\.greeting\.subtext", \{\s*restaurant: restaurant\.name/
  );

  // Leave card.title / recommendedAction tip paths alone (#1049 / #1134 own those modules).
  assert.doesNotMatch(homeSource, /normalizeHomeApprovalsCardTitle/);
  assert.doesNotMatch(homeSource, /normalizeHomeApprovalsRecommendedAction/);
  assert.equal(
    (() => {
      try {
        readFileSync(titleIdentityPath, "utf8");
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
        readFileSync(recommendedActionIdentityPath, "utf8");
        return "present";
      } catch {
        return "absent";
      }
    })(),
    "absent"
  );

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationHomeApprovalsCardTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeApprovalsRecommendedActionIdentity/);
  assert.doesNotMatch(identityCode, /homeStatusApprovalTitleIdentity/);
  assert.doesNotMatch(identityCode, /dailyBriefRecommendedActionEditIdentity/);
  assert.doesNotMatch(identityCode, /operationalFindingRecommendedActionIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeHomeApprovalsWhyItMatters(whyItMatters), whyItMatters);
  assert.equal(normalizeHomeApprovalsWhyItMatters(` ${whyItMatters} `), whyItMatters);
  assert.equal(
    normalizeHomeApprovalsWhyItMatters(`Por qué ${whyItMatters}`),
    `Por qué ${whyItMatters}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Home ApprovalsSection whyItMatters", () => {
  const padded = `${em}${whyItMatters}${em}`;
  const nbspWhy = `${nbsp}${whyItMatters}${nbsp}`;
  const internalEm = `Lunch${em}usage was 24% above forecast.`;
  const internalNbsp = `Lunch${nbsp}usage was 24% above forecast.`;
  const multiline = `Lunch usage was 24%\nabove forecast.`;

  // Inventing proof: Unicode trim would invent the clean why-it-matters string.
  assert.equal(padded.trim(), whyItMatters);
  assert.equal(nbspWhy.trim(), whyItMatters);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspWhy), true);

  // ASCII C prep refuses that inventing equality for em-space padding.
  assert.equal(canonicalHomeApprovalsWhyItMatters(padded), padded);
  assert.equal(normalizeHomeApprovalsWhyItMatters(padded), null);
  assert.equal(normalizeHomeApprovalsWhyItMatters(padded) || "FALLBACK", "FALLBACK");

  // End NBSP folds to plain space then C-trims to the clean reason (durable
  // fold). Em-space end padding soft-nulls so display cannot invent equality.
  assert.equal(normalizeHomeApprovalsWhyItMatters(nbspWhy), whyItMatters);

  // Internal Unicode spaces: em-space preserved; NBSP folded to plain space.
  assert.equal(normalizeHomeApprovalsWhyItMatters(internalEm), internalEm);
  assert.equal(
    normalizeHomeApprovalsWhyItMatters(internalNbsp),
    "Lunch usage was 24% above forecast."
  );
  assert.equal(normalizeHomeApprovalsWhyItMatters(multiline), multiline);
});

test("soft empty, controls, and non-strings fail closed for Home ApprovalsSection whyItMatters", () => {
  assert.equal(normalizeHomeApprovalsWhyItMatters(undefined), null);
  assert.equal(normalizeHomeApprovalsWhyItMatters(null), null);
  assert.equal(normalizeHomeApprovalsWhyItMatters(""), null);
  assert.equal(normalizeHomeApprovalsWhyItMatters("   "), null);
  assert.equal(normalizeHomeApprovalsWhyItMatters(123 as unknown as string), null);
  assert.equal(normalizeHomeApprovalsWhyItMatters(`\u0001${whyItMatters}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeHomeApprovalsWhyItMatters(`${whyItMatters}\t`), whyItMatters);
  assert.equal(normalizeHomeApprovalsWhyItMatters(`${whyItMatters}\u0007`), null);
  assert.equal(normalizeHomeApprovalsWhyItMatters(em), null);
  // Internal LF/TAB/CR remain allowed (operator_note multiline allowlist).
  assert.equal(
    normalizeHomeApprovalsWhyItMatters(`Lunch usage was 24%\tabove forecast.`),
    `Lunch usage was 24%\tabove forecast.`
  );
});

test("Home ApprovalsSection bypass proof: empty and Unicode-only-space whyItMatters soft-null to localized none", () => {
  // Prior always-pass-whyItMatters path still rendered blank-looking metaLine Text.
  assert.equal(normalizeHomeApprovalsWhyItMatters(""), null);
  assert.equal(normalizeHomeApprovalsWhyItMatters(em), null);
  assert.equal(normalizeHomeApprovalsWhyItMatters(nbsp), null);
  assert.match(
    homeSource,
    /whyItMatters\s*\|\|\s*t\("home\.approvals\.whyItMatters\.none"\)/
  );
});

test("Home ApprovalsSection why-it-matters identity refuses Unicode inventing equality", () => {
  const padded = `${em}${whyItMatters}${em}`;
  assert.notEqual(canonicalHomeApprovalsWhyItMatters(padded), padded.trim());
  assert.equal(normalizeHomeApprovalsWhyItMatters(padded), null);
  assert.equal(normalizeHomeApprovalsWhyItMatters(`\t${whyItMatters}\n`), whyItMatters);
});

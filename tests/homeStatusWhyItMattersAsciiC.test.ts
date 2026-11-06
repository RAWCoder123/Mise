import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalHomeStatusWhyItMatters,
  normalizeHomeStatusWhyItMatters
} from "../services/domain/homeStatusWhyItMattersIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/homeStatusWhyItMattersIdentity.ts", import.meta.url),
  "utf8"
);
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");
const approvalsWhyIdentityPath = new URL(
  "../services/domain/presentationHomeApprovalsWhyItMattersIdentity.ts",
  import.meta.url
);
const titleIdentityPath = new URL(
  "../services/domain/homeStatusApprovalTitleIdentity.ts",
  import.meta.url
);
const recommendedActionIdentityPath = new URL(
  "../services/domain/presentationHomeApprovalsRecommendedActionIdentity.ts",
  import.meta.url
);

const whyItMatters = "Lunch usage was 24% above forecast.";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005YD pins Home StatusNotice primaryApproval.whyItMatters to ASCII C", () => {
  assert.match(identitySource, /MISE-005YD/);
  assert.match(homeSource, /MISE-005YD/);

  assert.match(
    identitySource,
    /export function canonicalHomeStatusWhyItMatters\(value: string\) \{\s*return value\s*\.replace\(\/\\u00a0\/g, " "\)/
  );

  assert.match(
    homeSource,
    /from "\.\.\/\.\.\/services\/domain\/homeStatusWhyItMattersIdentity"/
  );
  assert.match(homeSource, /normalizeHomeStatusWhyItMatters\(/);
  assert.match(
    homeSource,
    /approvalWhyItMatters\s*\|\|\s*brief\.restaurantStatus\.summary/
  );
  assert.doesNotMatch(
    homeSource,
    /primaryApproval\?\.whyItMatters\s*\?\?\s*brief\.restaurantStatus\.summary/
  );

  // Leave ApprovalsSection whyItMatters / title / recommendedAction as raw
  // pass-through on this tip (open #1135 / #1049 / #1134 own those surfaces).
  assert.match(
    homeSource,
    /\{t\("home\.approvals\.why"\)\}: \{card\.whyItMatters\}/
  );
  assert.match(homeSource, /\{card\.title\}/);
  assert.match(homeSource, /\{card\.recommendedAction\}/);

  // Leave StatusNotice approval title raw on main (open #1011).
  assert.match(homeSource, /primaryApproval\?\.title \|\| t\(statusKey\)/);

  // Leave Home greeting restaurant.name alone on main (open #1044).
  assert.match(
    homeSource,
    /t\("home\.greeting\.subtext", \{\s*restaurant: restaurant\.name/
  );

  // Leave sibling tip modules alone on this branch.
  assert.doesNotMatch(homeSource, /normalizeHomeApprovalsWhyItMatters/);
  assert.doesNotMatch(homeSource, /normalizeHomeStatusApprovalTitle/);
  assert.doesNotMatch(homeSource, /normalizeHomeApprovalsRecommendedAction/);
  assert.equal(
    (() => {
      try {
        readFileSync(approvalsWhyIdentityPath, "utf8");
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
  assert.doesNotMatch(identityCode, /presentationHomeApprovalsWhyItMattersIdentity/);
  assert.doesNotMatch(identityCode, /homeStatusApprovalTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeApprovalsRecommendedActionIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeApprovalsCardTitleIdentity/);
  assert.doesNotMatch(identityCode, /dailyBriefRecommendedActionEditIdentity/);
  assert.doesNotMatch(identityCode, /operationalFindingRecommendedActionIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeHomeStatusWhyItMatters(whyItMatters), whyItMatters);
  assert.equal(normalizeHomeStatusWhyItMatters(` ${whyItMatters} `), whyItMatters);
  assert.equal(
    normalizeHomeStatusWhyItMatters(`Por qué ${whyItMatters}`),
    `Por qué ${whyItMatters}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Home StatusNotice whyItMatters", () => {
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
  assert.equal(canonicalHomeStatusWhyItMatters(padded), padded);
  assert.equal(normalizeHomeStatusWhyItMatters(padded), null);
  assert.equal(normalizeHomeStatusWhyItMatters(padded) || "FALLBACK", "FALLBACK");

  // End NBSP folds to plain space then C-trims to the clean reason (durable
  // fold). Em-space end padding soft-nulls so display cannot invent equality.
  assert.equal(normalizeHomeStatusWhyItMatters(nbspWhy), whyItMatters);

  // Internal Unicode spaces: em-space preserved; NBSP folded to plain space.
  assert.equal(normalizeHomeStatusWhyItMatters(internalEm), internalEm);
  assert.equal(
    normalizeHomeStatusWhyItMatters(internalNbsp),
    "Lunch usage was 24% above forecast."
  );
  assert.equal(normalizeHomeStatusWhyItMatters(multiline), multiline);
});

test("soft empty, controls, and non-strings fail closed for Home StatusNotice whyItMatters", () => {
  assert.equal(normalizeHomeStatusWhyItMatters(undefined), null);
  assert.equal(normalizeHomeStatusWhyItMatters(null), null);
  assert.equal(normalizeHomeStatusWhyItMatters(""), null);
  assert.equal(normalizeHomeStatusWhyItMatters("   "), null);
  assert.equal(normalizeHomeStatusWhyItMatters(123 as unknown as string), null);
  assert.equal(normalizeHomeStatusWhyItMatters(`\u0001${whyItMatters}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeHomeStatusWhyItMatters(`${whyItMatters}\t`), whyItMatters);
  assert.equal(normalizeHomeStatusWhyItMatters(`${whyItMatters}\u0007`), null);
  assert.equal(normalizeHomeStatusWhyItMatters(em), null);
  // Internal LF/TAB/CR remain allowed (operator_note multiline allowlist).
  assert.equal(
    normalizeHomeStatusWhyItMatters(`Lunch usage was 24%\tabove forecast.`),
    `Lunch usage was 24%\tabove forecast.`
  );
});

test("Home StatusNotice bypass proof: empty and Unicode-only-space whyItMatters soft-null to summary", () => {
  // Prior `??` path still rendered blank-looking StatusNotice message text:
  // empty string and Unicode-only space are non-nullish. Widen to
  // `string | null | undefined` so the proof matches the live optional
  // primaryApproval?.whyItMatters operand (TS otherwise marks `"" ??` unreachable).
  const emptyWhy: string | null | undefined = "";
  const unicodeOnlyWhy: string | null | undefined = em;
  assert.equal(emptyWhy ?? "SUMMARY", "");
  assert.equal(unicodeOnlyWhy ?? "SUMMARY", em);
  assert.equal(Boolean(em), true);
  assert.equal(normalizeHomeStatusWhyItMatters(""), null);
  assert.equal(normalizeHomeStatusWhyItMatters(em), null);
  assert.equal(normalizeHomeStatusWhyItMatters(nbsp), null);
  assert.equal(normalizeHomeStatusWhyItMatters("") || "SUMMARY", "SUMMARY");
  assert.equal(normalizeHomeStatusWhyItMatters(em) || "SUMMARY", "SUMMARY");
  assert.match(
    homeSource,
    /approvalWhyItMatters\s*\|\|\s*brief\.restaurantStatus\.summary/
  );
});

test("Home StatusNotice why-it-matters identity refuses Unicode inventing equality", () => {
  const padded = `${em}${whyItMatters}${em}`;
  assert.notEqual(canonicalHomeStatusWhyItMatters(padded), padded.trim());
  assert.equal(normalizeHomeStatusWhyItMatters(padded), null);
  assert.equal(normalizeHomeStatusWhyItMatters(`\t${whyItMatters}\n`), whyItMatters);
});

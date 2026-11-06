import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalHomeStatusTopRisk,
  normalizeHomeStatusTopRisk
} from "../services/domain/homeStatusTopRiskIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/homeStatusTopRiskIdentity.ts", import.meta.url),
  "utf8"
);
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");
const summaryIdentityPath = new URL(
  "../services/domain/homeStatusRestaurantSummaryIdentity.ts",
  import.meta.url
);
const statusWhyIdentityPath = new URL(
  "../services/domain/homeStatusWhyItMattersIdentity.ts",
  import.meta.url
);
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

const topRisk = "Chicken breast is projected to stock out before dinner.";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005YF pins Home StatusNotice restaurantStatus.topRisk to ASCII C", () => {
  assert.match(identitySource, /MISE-005YF/);
  assert.match(homeSource, /MISE-005YF/);

  assert.match(
    identitySource,
    /export function canonicalHomeStatusTopRisk\(value: string\) \{\s*return value\s*\.replace\(\/\\u00a0\/g, " "\)/
  );

  assert.match(
    homeSource,
    /from "\.\.\/\.\.\/services\/domain\/homeStatusTopRiskIdentity"/
  );
  assert.match(homeSource, /normalizeHomeStatusTopRisk\(/);
  assert.match(
    homeSource,
    /message=\{topRisk \? t\(statusKey\) : primaryApproval\?\.whyItMatters \?\? brief\.restaurantStatus\.summary\}/
  );
  assert.doesNotMatch(homeSource, /brief\.restaurantStatus\.topRisk\?\.trim\(\)/);

  // Leave StatusNotice summary / whyItMatters raw on main (open #1137 / #1136).
  assert.doesNotMatch(homeSource, /normalizeHomeStatusRestaurantSummary/);
  assert.doesNotMatch(homeSource, /normalizeHomeStatusWhyItMatters/);
  assert.match(homeSource, /primaryApproval\?\.whyItMatters\s*\?\?\s*brief\.restaurantStatus\.summary/);

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
        readFileSync(summaryIdentityPath, "utf8");
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
        readFileSync(statusWhyIdentityPath, "utf8");
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
  assert.doesNotMatch(identityCode, /homeStatusRestaurantSummaryIdentity/);
  assert.doesNotMatch(identityCode, /homeStatusWhyItMattersIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeApprovalsWhyItMattersIdentity/);
  assert.doesNotMatch(identityCode, /homeStatusApprovalTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeApprovalsRecommendedActionIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeApprovalsCardTitleIdentity/);
  assert.doesNotMatch(identityCode, /dailyBriefRecommendedActionEditIdentity/);
  assert.doesNotMatch(identityCode, /operationalFindingRecommendedActionIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeHomeStatusTopRisk(topRisk), topRisk);
  assert.equal(normalizeHomeStatusTopRisk(` ${topRisk} `), topRisk);
  assert.equal(
    normalizeHomeStatusTopRisk(`Atención ${topRisk}`),
    `Atención ${topRisk}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Home StatusNotice topRisk gate", () => {
  const padded = `${em}${topRisk}${em}`;
  const nbspRisk = `${nbsp}${topRisk}${nbsp}`;
  const internalEm = `Chicken${em}breast is projected to stock out before dinner.`;
  const internalNbsp = `Chicken${nbsp}breast is projected to stock out before dinner.`;
  const multiline = `Chicken breast is projected to stock out\nbefore dinner.`;

  // Inventing proof: Unicode trim would invent the clean topRisk string / gate.
  assert.equal(padded.trim(), topRisk);
  assert.equal(nbspRisk.trim(), topRisk);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspRisk), true);
  assert.equal(Boolean(padded.trim()), true);

  // ASCII C prep refuses that inventing equality for em-space padding.
  assert.equal(canonicalHomeStatusTopRisk(padded), padded);
  assert.equal(normalizeHomeStatusTopRisk(padded), null);
  assert.equal(normalizeHomeStatusTopRisk(padded) ? "STATUS_KEY" : "FALLTHROUGH", "FALLTHROUGH");

  // End NBSP folds to plain space then C-trims to the clean topRisk (durable
  // fold). Em-space end padding soft-nulls so the gate cannot invent equality.
  assert.equal(normalizeHomeStatusTopRisk(nbspRisk), topRisk);
  assert.equal(normalizeHomeStatusTopRisk(nbspRisk) ? "STATUS_KEY" : "FALLTHROUGH", "STATUS_KEY");

  // Internal Unicode spaces: em-space preserved; NBSP folded to plain space.
  assert.equal(normalizeHomeStatusTopRisk(internalEm), internalEm);
  assert.equal(
    normalizeHomeStatusTopRisk(internalNbsp),
    "Chicken breast is projected to stock out before dinner."
  );
  assert.equal(normalizeHomeStatusTopRisk(multiline), multiline);
});

test("soft empty, controls, and non-strings fail closed for Home StatusNotice topRisk", () => {
  assert.equal(normalizeHomeStatusTopRisk(undefined), null);
  assert.equal(normalizeHomeStatusTopRisk(null), null);
  assert.equal(normalizeHomeStatusTopRisk(""), null);
  assert.equal(normalizeHomeStatusTopRisk("   "), null);
  assert.equal(normalizeHomeStatusTopRisk(123 as unknown as string), null);
  assert.equal(normalizeHomeStatusTopRisk(`\u0001${topRisk}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeHomeStatusTopRisk(`${topRisk}\t`), topRisk);
  assert.equal(normalizeHomeStatusTopRisk(`${topRisk}\u0007`), null);
  assert.equal(normalizeHomeStatusTopRisk(em), null);
  // Internal LF/TAB/CR remain allowed (operator_note multiline allowlist).
  assert.equal(
    normalizeHomeStatusTopRisk(`Chicken breast:\tprojected stockout.`),
    `Chicken breast:\tprojected stockout.`
  );
});

test("Home StatusNotice bypass proof: empty and Unicode-only-space topRisk soft-null to fallthrough", () => {
  // Prior `.trim()` gate: empty string is already falsy after optional chaining,
  // but Unicode-only space is non-nullish (`Boolean("\u2003") === true`) and
  // would force t(statusKey) if the gate used raw truthiness without soft-null.
  // Soft-null restores the intentional why-it-matters / summary fallthrough.
  const emptyRisk: string | null | undefined = "";
  const unicodeOnlyRisk: string | null | undefined = em;
  assert.equal(Boolean(emptyRisk?.trim()), false);
  assert.equal(Boolean(unicodeOnlyRisk), true);
  assert.equal(Boolean(unicodeOnlyRisk?.trim()), false);
  assert.equal(normalizeHomeStatusTopRisk(""), null);
  assert.equal(normalizeHomeStatusTopRisk(em), null);
  assert.equal(normalizeHomeStatusTopRisk(nbsp), null);
  assert.equal(normalizeHomeStatusTopRisk("") ? "STATUS_KEY" : "FALLTHROUGH", "FALLTHROUGH");
  assert.equal(normalizeHomeStatusTopRisk(em) ? "STATUS_KEY" : "FALLTHROUGH", "FALLTHROUGH");
  assert.match(
    homeSource,
    /message=\{topRisk \? t\(statusKey\) : primaryApproval\?\.whyItMatters \?\? brief\.restaurantStatus\.summary\}/
  );
});

test("Home StatusNotice topRisk identity refuses Unicode inventing equality", () => {
  const padded = `${em}${topRisk}${em}`;
  assert.notEqual(canonicalHomeStatusTopRisk(padded), padded.trim());
  assert.equal(normalizeHomeStatusTopRisk(padded), null);
  assert.equal(normalizeHomeStatusTopRisk(`\t${topRisk}\n`), topRisk);
});

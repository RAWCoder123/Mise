import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalHomeStatusRestaurantSummary,
  normalizeHomeStatusRestaurantSummary
} from "../services/domain/homeStatusRestaurantSummaryIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/homeStatusRestaurantSummaryIdentity.ts", import.meta.url),
  "utf8"
);
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");
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

const summary =
  "Attention needed: 1 approval and 2 inventory watch items are open.";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005YE pins Home StatusNotice restaurantStatus.summary to ASCII C", () => {
  assert.match(identitySource, /MISE-005YE/);
  assert.match(homeSource, /MISE-005YE/);

  assert.match(
    identitySource,
    /export function canonicalHomeStatusRestaurantSummary\(value: string\) \{\s*return value\s*\.replace\(\/\\u00a0\/g, " "\)/
  );

  assert.match(
    homeSource,
    /from "\.\.\/\.\.\/services\/domain\/homeStatusRestaurantSummaryIdentity"/
  );
  assert.match(homeSource, /normalizeHomeStatusRestaurantSummary\(/);
  assert.match(
    homeSource,
    /primaryApproval\?\.whyItMatters\s*\?\?\s*restaurantStatusSummary\s*\?\?\s*t\(statusKey\)/
  );
  assert.doesNotMatch(
    homeSource,
    /primaryApproval\?\.whyItMatters\s*\?\?\s*brief\.restaurantStatus\.summary(?!\s*\?\?)/
  );

  // Leave StatusNotice whyItMatters raw on main (open #1136).
  assert.doesNotMatch(homeSource, /normalizeHomeStatusWhyItMatters/);
  assert.match(homeSource, /primaryApproval\?\.whyItMatters\s*\?\?/);

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

  // Leave topRisk Unicode trim gate alone on this tip.
  assert.match(homeSource, /brief\.restaurantStatus\.topRisk\?\.trim\(\)/);

  // Leave sibling tip modules alone on this branch.
  assert.doesNotMatch(homeSource, /normalizeHomeApprovalsWhyItMatters/);
  assert.doesNotMatch(homeSource, /normalizeHomeStatusApprovalTitle/);
  assert.doesNotMatch(homeSource, /normalizeHomeApprovalsRecommendedAction/);
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
  assert.doesNotMatch(identityCode, /homeStatusWhyItMattersIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeApprovalsWhyItMattersIdentity/);
  assert.doesNotMatch(identityCode, /homeStatusApprovalTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeApprovalsRecommendedActionIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeApprovalsCardTitleIdentity/);
  assert.doesNotMatch(identityCode, /dailyBriefRecommendedActionEditIdentity/);
  assert.doesNotMatch(identityCode, /operationalFindingRecommendedActionIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeHomeStatusRestaurantSummary(summary), summary);
  assert.equal(normalizeHomeStatusRestaurantSummary(` ${summary} `), summary);
  assert.equal(
    normalizeHomeStatusRestaurantSummary(`Atención ${summary}`),
    `Atención ${summary}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Home StatusNotice summary", () => {
  const padded = `${em}${summary}${em}`;
  const nbspSummary = `${nbsp}${summary}${nbsp}`;
  const internalEm = `Attention${em}needed: 1 approval and 2 inventory watch items are open.`;
  const internalNbsp = `Attention${nbsp}needed: 1 approval and 2 inventory watch items are open.`;
  const multiline = `Attention needed:\n1 approval and 2 inventory watch items are open.`;

  // Inventing proof: Unicode trim would invent the clean summary string.
  assert.equal(padded.trim(), summary);
  assert.equal(nbspSummary.trim(), summary);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspSummary), true);

  // ASCII C prep refuses that inventing equality for em-space padding.
  assert.equal(canonicalHomeStatusRestaurantSummary(padded), padded);
  assert.equal(normalizeHomeStatusRestaurantSummary(padded), null);
  assert.equal(normalizeHomeStatusRestaurantSummary(padded) ?? "FALLBACK", "FALLBACK");

  // End NBSP folds to plain space then C-trims to the clean summary (durable
  // fold). Em-space end padding soft-nulls so display cannot invent equality.
  assert.equal(normalizeHomeStatusRestaurantSummary(nbspSummary), summary);

  // Internal Unicode spaces: em-space preserved; NBSP folded to plain space.
  assert.equal(normalizeHomeStatusRestaurantSummary(internalEm), internalEm);
  assert.equal(
    normalizeHomeStatusRestaurantSummary(internalNbsp),
    "Attention needed: 1 approval and 2 inventory watch items are open."
  );
  assert.equal(normalizeHomeStatusRestaurantSummary(multiline), multiline);
});

test("soft empty, controls, and non-strings fail closed for Home StatusNotice summary", () => {
  assert.equal(normalizeHomeStatusRestaurantSummary(undefined), null);
  assert.equal(normalizeHomeStatusRestaurantSummary(null), null);
  assert.equal(normalizeHomeStatusRestaurantSummary(""), null);
  assert.equal(normalizeHomeStatusRestaurantSummary("   "), null);
  assert.equal(normalizeHomeStatusRestaurantSummary(123 as unknown as string), null);
  assert.equal(normalizeHomeStatusRestaurantSummary(`\u0001${summary}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeHomeStatusRestaurantSummary(`${summary}\t`), summary);
  assert.equal(normalizeHomeStatusRestaurantSummary(`${summary}\u0007`), null);
  assert.equal(normalizeHomeStatusRestaurantSummary(em), null);
  // Internal LF/TAB/CR remain allowed (operator_note multiline allowlist).
  assert.equal(
    normalizeHomeStatusRestaurantSummary(`Attention needed:\t1 approval open.`),
    `Attention needed:\t1 approval open.`
  );
});

test("Home StatusNotice bypass proof: empty and Unicode-only-space summary soft-null to statusKey", () => {
  // Prior raw-summary path still rendered blank-looking StatusNotice message
  // text: empty string and Unicode-only space are non-nullish and ended the
  // message chain with no intentional localized status-sentence fallback.
  // Widen to `string | null | undefined` so the proof matches the live
  // restaurantStatus.summary operand after soft normalize.
  const emptySummary: string | null | undefined = "";
  const unicodeOnlySummary: string | null | undefined = em;
  assert.equal(emptySummary ?? "STATUS_KEY", "");
  assert.equal(unicodeOnlySummary ?? "STATUS_KEY", em);
  assert.equal(Boolean(em), true);
  assert.equal(normalizeHomeStatusRestaurantSummary(""), null);
  assert.equal(normalizeHomeStatusRestaurantSummary(em), null);
  assert.equal(normalizeHomeStatusRestaurantSummary(nbsp), null);
  assert.equal(normalizeHomeStatusRestaurantSummary("") ?? "STATUS_KEY", "STATUS_KEY");
  assert.equal(normalizeHomeStatusRestaurantSummary(em) ?? "STATUS_KEY", "STATUS_KEY");
  assert.match(
    homeSource,
    /restaurantStatusSummary\s*\?\?\s*t\(statusKey\)/
  );
});

test("Home StatusNotice restaurant-status summary identity refuses Unicode inventing equality", () => {
  const padded = `${em}${summary}${em}`;
  assert.notEqual(canonicalHomeStatusRestaurantSummary(padded), padded.trim());
  assert.equal(normalizeHomeStatusRestaurantSummary(padded), null);
  assert.equal(normalizeHomeStatusRestaurantSummary(`\t${summary}\n`), summary);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalHomeApprovalsRecommendedAction,
  normalizeHomeApprovalsRecommendedAction
} from "../services/domain/presentationHomeApprovalsRecommendedActionIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationHomeApprovalsRecommendedActionIdentity.ts", import.meta.url),
  "utf8"
);
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const titleIdentityPath = new URL(
  "../services/domain/presentationHomeApprovalsCardTitleIdentity.ts",
  import.meta.url
);

const recommendedAction = "Order 12 lb from Fresh Produce Co.";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005YB pins Home ApprovalsSection card.recommendedAction to ASCII C", () => {
  assert.match(identitySource, /MISE-005YB/);
  assert.match(homeSource, /MISE-005YB/);

  assert.match(
    identitySource,
    /export function canonicalHomeApprovalsRecommendedAction\(value: string\) \{\s*return value\s*\.replace\(\/\\u00a0\/g, " "\)/
  );

  assert.match(
    homeSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationHomeApprovalsRecommendedActionIdentity"/
  );
  assert.match(homeSource, /normalizeHomeApprovalsRecommendedAction\(/);
  assert.match(
    homeSource,
    /recommendedAction\s*\|\|\s*t\("home\.approvals\.recommendedAction\.none"\)/
  );
  assert.doesNotMatch(
    homeSource,
    /<Text style=\{styles\.cardBody\}>\{card\.recommendedAction\}<\/Text>/
  );

  assert.match(
    catalogSource,
    /"home\.approvals\.recommendedAction\.none": "Review the recommended action"/
  );
  assert.match(
    catalogSource,
    /"home\.approvals\.recommendedAction\.none": "Revisa la acción recomendada"/
  );
  assert.match(catalogSource, /"home\.approvals\.recommendedAction\.none": "查看建议操作"/);

  // Leave ApprovalsSection title / why copy as raw pass-through on this tip.
  assert.match(homeSource, /\{card\.title\}/);
  assert.match(homeSource, /\{card\.whyItMatters\}/);

  // Leave Home greeting restaurant.name alone on main (open #1044).
  assert.match(
    homeSource,
    /t\("home\.greeting\.subtext", \{\s*restaurant: restaurant\.name/
  );

  // Leave card.title tip path alone (#1049 owns that module).
  assert.doesNotMatch(homeSource, /normalizeHomeApprovalsCardTitle/);
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

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationHomeApprovalsCardTitleIdentity/);
  assert.doesNotMatch(identityCode, /homeStatusApprovalTitleIdentity/);
  assert.doesNotMatch(identityCode, /dailyBriefRecommendedActionEditIdentity/);
  assert.doesNotMatch(identityCode, /operationalFindingRecommendedActionIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeHomeApprovalsRecommendedAction(recommendedAction), recommendedAction);
  assert.equal(
    normalizeHomeApprovalsRecommendedAction(` ${recommendedAction} `),
    recommendedAction
  );
  assert.equal(
    normalizeHomeApprovalsRecommendedAction(`Pedir ${recommendedAction}`),
    `Pedir ${recommendedAction}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Home ApprovalsSection recommended actions", () => {
  const padded = `${em}${recommendedAction}${em}`;
  const nbspAction = `${nbsp}${recommendedAction}${nbsp}`;
  const internalEm = `Order${em}12 lb from Fresh Produce Co.`;
  const internalNbsp = `Order${nbsp}12 lb from Fresh Produce Co.`;
  const multiline = `Order 12 lb\nfrom Fresh Produce Co.`;

  // Inventing proof: Unicode trim would invent the clean recommended action.
  assert.equal(padded.trim(), recommendedAction);
  assert.equal(nbspAction.trim(), recommendedAction);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspAction), true);

  // ASCII C prep refuses that inventing equality for em-space padding.
  assert.equal(canonicalHomeApprovalsRecommendedAction(padded), padded);
  assert.equal(normalizeHomeApprovalsRecommendedAction(padded), null);
  assert.equal(normalizeHomeApprovalsRecommendedAction(padded) || "FALLBACK", "FALLBACK");

  // End NBSP folds to plain space then C-trims to the clean action (durable
  // fold). Em-space end padding soft-nulls so display cannot invent equality.
  assert.equal(normalizeHomeApprovalsRecommendedAction(nbspAction), recommendedAction);

  // Internal Unicode spaces: em-space preserved; NBSP folded to plain space.
  assert.equal(normalizeHomeApprovalsRecommendedAction(internalEm), internalEm);
  assert.equal(
    normalizeHomeApprovalsRecommendedAction(internalNbsp),
    "Order 12 lb from Fresh Produce Co."
  );
  assert.equal(normalizeHomeApprovalsRecommendedAction(multiline), multiline);
});

test("soft empty, controls, and non-strings fail closed for Home ApprovalsSection recommended actions", () => {
  assert.equal(normalizeHomeApprovalsRecommendedAction(undefined), null);
  assert.equal(normalizeHomeApprovalsRecommendedAction(null), null);
  assert.equal(normalizeHomeApprovalsRecommendedAction(""), null);
  assert.equal(normalizeHomeApprovalsRecommendedAction("   "), null);
  assert.equal(normalizeHomeApprovalsRecommendedAction(123 as unknown as string), null);
  assert.equal(normalizeHomeApprovalsRecommendedAction(`\u0001${recommendedAction}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(
    normalizeHomeApprovalsRecommendedAction(`${recommendedAction}\t`),
    recommendedAction
  );
  assert.equal(normalizeHomeApprovalsRecommendedAction(`${recommendedAction}\u0007`), null);
  assert.equal(normalizeHomeApprovalsRecommendedAction(em), null);
  // Internal LF/TAB/CR remain allowed (operator_note multiline allowlist).
  assert.equal(
    normalizeHomeApprovalsRecommendedAction(`Order 12 lb\tfrom Fresh Produce Co.`),
    `Order 12 lb\tfrom Fresh Produce Co.`
  );
});

test("Home ApprovalsSection bypass proof: empty and Unicode-only-space recommended actions soft-null to localized none", () => {
  // Prior always-pass-recommendedAction path still rendered blank-looking cardBody Text.
  assert.equal(normalizeHomeApprovalsRecommendedAction(""), null);
  assert.equal(normalizeHomeApprovalsRecommendedAction(em), null);
  assert.equal(normalizeHomeApprovalsRecommendedAction(nbsp), null);
  assert.match(
    homeSource,
    /recommendedAction\s*\|\|\s*t\("home\.approvals\.recommendedAction\.none"\)/
  );
});

test("Home ApprovalsSection recommended-action identity refuses Unicode inventing equality", () => {
  const padded = `${em}${recommendedAction}${em}`;
  assert.notEqual(canonicalHomeApprovalsRecommendedAction(padded), padded.trim());
  assert.equal(normalizeHomeApprovalsRecommendedAction(padded), null);
  assert.equal(
    normalizeHomeApprovalsRecommendedAction(`\t${recommendedAction}\n`),
    recommendedAction
  );
});

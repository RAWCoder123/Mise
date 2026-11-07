import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalHomeActivityRowSummary,
  normalizeHomeActivityRowSummary
} from "../services/domain/presentationHomeActivityRowSummaryIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationHomeActivityRowSummaryIdentity.ts", import.meta.url),
  "utf8"
);
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const activitySource = readFileSync(
  new URL("../app/more/activity.tsx", import.meta.url),
  "utf8"
);
const activityRowSummaryIdentityPath = new URL(
  "../services/domain/presentationActivityRowSummaryIdentity.ts",
  import.meta.url
);
const homeActivityRowTitleIdentityPath = new URL(
  "../services/domain/presentationHomeActivityRowTitleIdentity.ts",
  import.meta.url
);
const activityRowTitleIdentityPath = new URL(
  "../services/domain/presentationActivityRowTitleIdentity.ts",
  import.meta.url
);

const summary = "Chicken Breast counted at 18 lb.";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005YS pins Home ActivityRow event.summary to ASCII C", () => {
  assert.match(identitySource, /MISE-005YS/);
  assert.match(homeSource, /MISE-005YS/);

  assert.match(
    identitySource,
    /export function canonicalHomeActivityRowSummary\(value: string\) \{\s*return value\s*\.replace\(\/\\u00a0\/g, " "\)/
  );

  assert.match(
    homeSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationHomeActivityRowSummaryIdentity"/
  );
  assert.match(homeSource, /normalizeHomeActivityRowSummary\(/);
  assert.match(
    homeSource,
    /normalizeHomeActivityRowSummary\(event\.summary\)\s*\|\|\s*t\("home\.activity\.row\.summary\.none"\)/
  );
  assert.doesNotMatch(
    homeSource,
    /activitySummary[^>]*>\s*\{event\.summary\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"home\.activity\.row\.summary\.none": "Activity details"/);
  assert.match(
    catalogSource,
    /"home\.activity\.row\.summary\.none": "Detalles de la actividad"/
  );
  assert.match(catalogSource, /"home\.activity\.row\.summary\.none": "活动详情"/);

  // Leave Home ActivityRow title as raw pass-through on this tip (#1149 owns that surface).
  assert.match(homeSource, /activityTitle[^>]*>\s*\{event\.title\}\s*<\/Text>/);

  // Leave Activity hub row summary as raw pass-through (#1150 owns that surface).
  assert.match(activitySource, /\{event\.summary\}/);

  assert.doesNotMatch(homeSource, /presentationActivityRowSummaryIdentity/);
  assert.doesNotMatch(homeSource, /normalizeActivityRowSummary/);
  assert.doesNotMatch(homeSource, /presentationHomeActivityRowTitleIdentity/);
  assert.doesNotMatch(homeSource, /normalizeHomeActivityRowTitle/);
  assert.doesNotMatch(activitySource, /presentationHomeActivityRowSummaryIdentity/);
  assert.doesNotMatch(activitySource, /normalizeHomeActivityRowSummary/);
  assert.equal(
    (() => {
      try {
        readFileSync(activityRowSummaryIdentityPath, "utf8");
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
        readFileSync(homeActivityRowTitleIdentityPath, "utf8");
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
        readFileSync(activityRowTitleIdentityPath, "utf8");
        return "present";
      } catch {
        return "absent";
      }
    })(),
    "absent"
  );

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationActivityRowSummaryIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeActivityRowTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationActivityRowTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyBriefBoardExplanationIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeHomeActivityRowSummary(summary), summary);
  assert.equal(normalizeHomeActivityRowSummary(` ${summary} `), summary);
  assert.equal(
    normalizeHomeActivityRowSummary(`Conteo: ${summary}`),
    `Conteo: ${summary}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Home ActivityRow summaries", () => {
  const padded = `${em}${summary}${em}`;
  const nbspSummary = `${nbsp}${summary}${nbsp}`;
  const internalEm = `Chicken${em}Breast counted at 18 lb.`;
  const internalNbsp = `Chicken${nbsp}Breast counted at 18 lb.`;
  const multiline = `Chicken Breast counted at 18 lb.\nReview variance before service.`;

  // Inventing proof: Unicode trim would invent the clean activity summary.
  assert.equal(padded.trim(), summary);
  assert.equal(nbspSummary.trim(), summary);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspSummary), true);

  // ASCII C prep refuses that inventing equality for em-space padding.
  assert.equal(canonicalHomeActivityRowSummary(padded), padded);
  assert.equal(normalizeHomeActivityRowSummary(padded), null);
  assert.equal(normalizeHomeActivityRowSummary(padded) || "FALLBACK", "FALLBACK");

  // End NBSP folds to plain space then C-trims to the clean summary (durable
  // fold). Em-space end padding soft-nulls so display cannot invent equality.
  assert.equal(normalizeHomeActivityRowSummary(nbspSummary), summary);

  // Internal Unicode spaces: em-space preserved; NBSP folded to plain space.
  assert.equal(normalizeHomeActivityRowSummary(internalEm), internalEm);
  assert.equal(
    normalizeHomeActivityRowSummary(internalNbsp),
    "Chicken Breast counted at 18 lb."
  );
  assert.equal(normalizeHomeActivityRowSummary(multiline), multiline);
});

test("soft empty, controls, and non-strings fail closed for Home ActivityRow summaries", () => {
  assert.equal(normalizeHomeActivityRowSummary(undefined), null);
  assert.equal(normalizeHomeActivityRowSummary(null), null);
  assert.equal(normalizeHomeActivityRowSummary(""), null);
  assert.equal(normalizeHomeActivityRowSummary("   "), null);
  assert.equal(normalizeHomeActivityRowSummary(123 as unknown as string), null);
  assert.equal(normalizeHomeActivityRowSummary(`\u0001${summary}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeHomeActivityRowSummary(`${summary}\t`), summary);
  assert.equal(normalizeHomeActivityRowSummary(`${summary}\u0007`), null);
  assert.equal(normalizeHomeActivityRowSummary(em), null);
  // Internal LF/TAB/CR remain allowed (operator_note multiline allowlist).
  assert.equal(
    normalizeHomeActivityRowSummary(`Chicken Breast\tcounted at 18 lb.`),
    `Chicken Breast\tcounted at 18 lb.`
  );
});

test("Home ActivityRow bypass proof: empty and Unicode-only-space summaries soft-null to localized none", () => {
  // Prior always-pass-summary path still rendered blank-looking summary Text.
  assert.equal(normalizeHomeActivityRowSummary(""), null);
  assert.equal(normalizeHomeActivityRowSummary(em), null);
  assert.equal(normalizeHomeActivityRowSummary(nbsp), null);
  assert.match(
    homeSource,
    /normalizeHomeActivityRowSummary\(event\.summary\)\s*\|\|\s*t\("home\.activity\.row\.summary\.none"\)/
  );
});

test("Home ActivityRow event.summary identity refuses Unicode inventing equality", () => {
  const padded = `${em}${summary}${em}`;
  assert.notEqual(canonicalHomeActivityRowSummary(padded), padded.trim());
  assert.equal(normalizeHomeActivityRowSummary(padded), null);
  assert.equal(normalizeHomeActivityRowSummary(`\t${summary}\n`), summary);
});

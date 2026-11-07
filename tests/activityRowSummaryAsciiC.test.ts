import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalActivityRowSummary,
  normalizeActivityRowSummary
} from "../services/domain/presentationActivityRowSummaryIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationActivityRowSummaryIdentity.ts", import.meta.url),
  "utf8"
);
const activitySource = readFileSync(
  new URL("../app/more/activity.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");
const activityRowTitleIdentityPath = new URL(
  "../services/domain/presentationActivityRowTitleIdentity.ts",
  import.meta.url
);
const homeActivityRowTitleIdentityPath = new URL(
  "../services/domain/presentationHomeActivityRowTitleIdentity.ts",
  import.meta.url
);
const homeActivityRowSummaryIdentityPath = new URL(
  "../services/domain/presentationHomeActivityRowSummaryIdentity.ts",
  import.meta.url
);

const summary = "Chicken Breast counted at 18 lb.";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005YR pins Activity row event.summary to ASCII C", () => {
  assert.match(identitySource, /MISE-005YR/);
  assert.match(activitySource, /MISE-005YR/);

  assert.match(
    identitySource,
    /export function canonicalActivityRowSummary\(value: string\) \{\s*return value\s*\.replace\(\/\\u00a0\/g, " "\)/
  );

  assert.match(
    activitySource,
    /from "\.\.\/\.\.\/services\/domain\/presentationActivityRowSummaryIdentity"/
  );
  assert.match(activitySource, /normalizeActivityRowSummary\(/);
  assert.match(
    activitySource,
    /normalizeActivityRowSummary\(event\.summary\)\s*\|\|\s*t\("activity\.row\.summary\.none"\)/
  );
  assert.doesNotMatch(
    activitySource,
    /summary[^>]*>\s*\{event\.summary\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"activity\.row\.summary\.none": "Activity details"/);
  assert.match(
    catalogSource,
    /"activity\.row\.summary\.none": "Detalles de la actividad"/
  );
  assert.match(catalogSource, /"activity\.row\.summary\.none": "活动详情"/);

  // Leave Activity row title as raw pass-through on this tip (#1148 owns that surface).
  assert.match(activitySource, /\{event\.title\}/);

  // Leave Home ActivityRow summary as raw pass-through (next inventing candidate).
  assert.match(homeSource, /activitySummary[^>]*>\s*\{event\.summary\}\s*<\/Text>/);

  assert.doesNotMatch(activitySource, /presentationActivityRowTitleIdentity/);
  assert.doesNotMatch(activitySource, /normalizeActivityRowTitle/);
  assert.doesNotMatch(activitySource, /presentationHomeActivityRowSummaryIdentity/);
  assert.doesNotMatch(homeSource, /presentationActivityRowSummaryIdentity/);
  assert.doesNotMatch(homeSource, /normalizeActivityRowSummary/);
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
        readFileSync(homeActivityRowSummaryIdentityPath, "utf8");
        return "present";
      } catch {
        return "absent";
      }
    })(),
    "absent"
  );

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationActivityRowTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeActivityRowTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeActivityRowSummaryIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyBriefBoardExplanationIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeActivityRowSummary(summary), summary);
  assert.equal(normalizeActivityRowSummary(` ${summary} `), summary);
  assert.equal(
    normalizeActivityRowSummary(`Conteo: ${summary}`),
    `Conteo: ${summary}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Activity row summaries", () => {
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
  assert.equal(canonicalActivityRowSummary(padded), padded);
  assert.equal(normalizeActivityRowSummary(padded), null);
  assert.equal(normalizeActivityRowSummary(padded) || "FALLBACK", "FALLBACK");

  // End NBSP folds to plain space then C-trims to the clean summary (durable
  // fold). Em-space end padding soft-nulls so display cannot invent equality.
  assert.equal(normalizeActivityRowSummary(nbspSummary), summary);

  // Internal Unicode spaces: em-space preserved; NBSP folded to plain space.
  assert.equal(normalizeActivityRowSummary(internalEm), internalEm);
  assert.equal(
    normalizeActivityRowSummary(internalNbsp),
    "Chicken Breast counted at 18 lb."
  );
  assert.equal(normalizeActivityRowSummary(multiline), multiline);
});

test("soft empty, controls, and non-strings fail closed for Activity row summaries", () => {
  assert.equal(normalizeActivityRowSummary(undefined), null);
  assert.equal(normalizeActivityRowSummary(null), null);
  assert.equal(normalizeActivityRowSummary(""), null);
  assert.equal(normalizeActivityRowSummary("   "), null);
  assert.equal(normalizeActivityRowSummary(123 as unknown as string), null);
  assert.equal(normalizeActivityRowSummary(`\u0001${summary}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeActivityRowSummary(`${summary}\t`), summary);
  assert.equal(normalizeActivityRowSummary(`${summary}\u0007`), null);
  assert.equal(normalizeActivityRowSummary(em), null);
  // Internal LF/TAB/CR remain allowed (operator_note multiline allowlist).
  assert.equal(
    normalizeActivityRowSummary(`Chicken Breast\tcounted at 18 lb.`),
    `Chicken Breast\tcounted at 18 lb.`
  );
});

test("Activity row bypass proof: empty and Unicode-only-space summaries soft-null to localized none", () => {
  // Prior always-pass-summary path still rendered blank-looking summary Text.
  assert.equal(normalizeActivityRowSummary(""), null);
  assert.equal(normalizeActivityRowSummary(em), null);
  assert.equal(normalizeActivityRowSummary(nbsp), null);
  assert.match(
    activitySource,
    /normalizeActivityRowSummary\(event\.summary\)\s*\|\|\s*t\("activity\.row\.summary\.none"\)/
  );
});

test("Activity row event.summary identity refuses Unicode inventing equality", () => {
  const padded = `${em}${summary}${em}`;
  assert.notEqual(canonicalActivityRowSummary(padded), padded.trim());
  assert.equal(normalizeActivityRowSummary(padded), null);
  assert.equal(normalizeActivityRowSummary(`\t${summary}\n`), summary);
});

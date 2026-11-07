import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalActivityEvidenceSummary,
  normalizeActivityEvidenceSummary
} from "../services/domain/presentationActivityEvidenceSummaryIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationActivityEvidenceSummaryIdentity.ts", import.meta.url),
  "utf8"
);
const activitySource = readFileSync(new URL("../app/more/activity.tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const memorySource = readFileSync(
  new URL("../app/more/restaurant-memory.tsx", import.meta.url),
  "utf8"
);
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");
const activityRowSummaryIdentityPath = new URL(
  "../services/domain/presentationActivityRowSummaryIdentity.ts",
  import.meta.url
);
const homeActivityRowSummaryIdentityPath = new URL(
  "../services/domain/presentationHomeActivityRowSummaryIdentity.ts",
  import.meta.url
);
const restaurantMemoryEvidenceSummaryIdentityPath = new URL(
  "../services/domain/presentationRestaurantMemoryEvidenceSummaryIdentity.ts",
  import.meta.url
);

const summary = "On-hand coverage below reorder point for Chicken Breast.";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005YW pins Activity expanded evidence.summary to ASCII C", () => {
  assert.match(identitySource, /MISE-005YW/);
  assert.match(activitySource, /MISE-005YW/);

  assert.match(
    identitySource,
    /export function canonicalActivityEvidenceSummary\(value: string\) \{\s*return value\s*\.replace\(\/\\u00a0\/g, " "\)/
  );

  assert.match(
    activitySource,
    /from "\.\.\/\.\.\/services\/domain\/presentationActivityEvidenceSummaryIdentity"/
  );
  assert.match(activitySource, /normalizeActivityEvidenceSummary\(/);
  assert.match(
    activitySource,
    /normalizeActivityEvidenceSummary\(evidence\.summary\)\s*\|\|\s*t\("activity\.evidence\.summary\.none"\)/
  );
  assert.doesNotMatch(
    activitySource,
    /\{evidence\.type\.replace\(\/_\/g, " "\)\} — \{evidence\.summary\}/
  );

  assert.match(catalogSource, /"activity\.evidence\.summary\.none": "Evidence details"/);
  assert.match(
    catalogSource,
    /"activity\.evidence\.summary\.none": "Detalles de la evidencia"/
  );
  assert.match(catalogSource, /"activity\.evidence\.summary\.none": "证据详情"/);

  // Leave Activity row event.summary as raw pass-through on this tip (#1150 owns that surface).
  assert.match(activitySource, /summary[^>]*>\s*\{event\.summary\}\s*<\/Text>/);

  // Leave Activity row event.title as raw pass-through (#1148 owns that surface).
  assert.match(activitySource, /\{event\.title\}/);

  // Leave Restaurant Memory evidence entry.summary as raw pass-through (#1154 owns that surface).
  assert.match(memorySource, /evidenceLine[^>]*>\s*\{entry\.summary\}/);

  // Leave Home ActivityRow summary as raw pass-through (#1151 owns that surface).
  assert.match(homeSource, /activitySummary[^>]*>\s*\{event\.summary\}\s*<\/Text>/);

  assert.doesNotMatch(activitySource, /presentationActivityRowSummaryIdentity/);
  assert.doesNotMatch(activitySource, /normalizeActivityRowSummary/);
  assert.doesNotMatch(activitySource, /presentationRestaurantMemoryEvidenceSummaryIdentity/);
  assert.doesNotMatch(activitySource, /normalizeRestaurantMemoryEvidenceSummary/);
  assert.doesNotMatch(memorySource, /presentationActivityEvidenceSummaryIdentity/);
  assert.doesNotMatch(memorySource, /normalizeActivityEvidenceSummary/);
  assert.doesNotMatch(homeSource, /presentationActivityEvidenceSummaryIdentity/);
  assert.doesNotMatch(homeSource, /normalizeActivityEvidenceSummary/);
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
        readFileSync(homeActivityRowSummaryIdentityPath, "utf8");
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
        readFileSync(restaurantMemoryEvidenceSummaryIdentityPath, "utf8");
        return "present";
      } catch {
        return "absent";
      }
    })(),
    "absent"
  );

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationActivityRowSummaryIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeActivityRowSummaryIdentity/);
  assert.doesNotMatch(identityCode, /presentationRestaurantMemoryEvidenceSummaryIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyBriefBoardExplanationIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeActivityEvidenceSummary(summary), summary);
  assert.equal(normalizeActivityEvidenceSummary(` ${summary} `), summary);
  assert.equal(
    normalizeActivityEvidenceSummary(`Cobertura: ${summary}`),
    `Cobertura: ${summary}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Activity evidence summaries", () => {
  const padded = `${em}${summary}${em}`;
  const nbspSummary = `${nbsp}${summary}${nbsp}`;
  const internalEm = `On-hand${em}coverage below reorder point for Chicken Breast.`;
  const internalNbsp = `On-hand${nbsp}coverage below reorder point for Chicken Breast.`;
  const multiline = `On-hand coverage below reorder point for Chicken Breast.\nReview before ordering.`;

  // Inventing proof: Unicode trim would invent the clean activity evidence summary.
  assert.equal(padded.trim(), summary);
  assert.equal(nbspSummary.trim(), summary);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspSummary), true);

  // ASCII C prep refuses that inventing equality for em-space padding.
  assert.equal(canonicalActivityEvidenceSummary(padded), padded);
  assert.equal(normalizeActivityEvidenceSummary(padded), null);
  assert.equal(normalizeActivityEvidenceSummary(padded) || "FALLBACK", "FALLBACK");

  // End NBSP folds to plain space then C-trims to the clean summary (durable
  // fold). Em-space end padding soft-nulls so display cannot invent equality.
  assert.equal(normalizeActivityEvidenceSummary(nbspSummary), summary);

  // Internal Unicode spaces: em-space preserved; NBSP folded to plain space.
  assert.equal(normalizeActivityEvidenceSummary(internalEm), internalEm);
  assert.equal(
    normalizeActivityEvidenceSummary(internalNbsp),
    "On-hand coverage below reorder point for Chicken Breast."
  );
  assert.equal(normalizeActivityEvidenceSummary(multiline), multiline);
});

test("soft empty, controls, and non-strings fail closed for Activity evidence summaries", () => {
  assert.equal(normalizeActivityEvidenceSummary(undefined), null);
  assert.equal(normalizeActivityEvidenceSummary(null), null);
  assert.equal(normalizeActivityEvidenceSummary(""), null);
  assert.equal(normalizeActivityEvidenceSummary("   "), null);
  assert.equal(normalizeActivityEvidenceSummary(123 as unknown as string), null);
  assert.equal(normalizeActivityEvidenceSummary(`\u0001${summary}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeActivityEvidenceSummary(`${summary}\t`), summary);
  assert.equal(normalizeActivityEvidenceSummary(`${summary}\u0007`), null);
  assert.equal(normalizeActivityEvidenceSummary(em), null);
  // Internal LF/TAB/CR remain allowed (operator_note multiline allowlist).
  assert.equal(
    normalizeActivityEvidenceSummary(`On-hand coverage\tbelow reorder point.`),
    `On-hand coverage\tbelow reorder point.`
  );
});

test("Activity evidence bypass proof: empty and Unicode-only-space summaries soft-null to localized none", () => {
  // Prior always-pass-summary path still rendered blank-looking evidence Text.
  assert.equal(normalizeActivityEvidenceSummary(""), null);
  assert.equal(normalizeActivityEvidenceSummary(em), null);
  assert.equal(normalizeActivityEvidenceSummary(nbsp), null);
  assert.match(
    activitySource,
    /normalizeActivityEvidenceSummary\(evidence\.summary\)\s*\|\|\s*t\("activity\.evidence\.summary\.none"\)/
  );
});

test("Activity expanded evidence.summary identity refuses Unicode inventing equality", () => {
  const padded = `${em}${summary}${em}`;
  assert.notEqual(canonicalActivityEvidenceSummary(padded), padded.trim());
  assert.equal(normalizeActivityEvidenceSummary(padded), null);
  assert.equal(normalizeActivityEvidenceSummary(`\t${summary}\n`), summary);
});

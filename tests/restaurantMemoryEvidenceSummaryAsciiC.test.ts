import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalRestaurantMemoryEvidenceSummary,
  normalizeRestaurantMemoryEvidenceSummary
} from "../services/domain/presentationRestaurantMemoryEvidenceSummaryIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationRestaurantMemoryEvidenceSummaryIdentity.ts", import.meta.url),
  "utf8"
);
const memorySource = readFileSync(
  new URL("../app/more/restaurant-memory.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const activitySource = readFileSync(new URL("../app/more/activity.tsx", import.meta.url), "utf8");
const restaurantMemoryStatementIdentityPath = new URL(
  "../services/domain/restaurantMemoryStatementIdentity.ts",
  import.meta.url
);
const activityRowSummaryIdentityPath = new URL(
  "../services/domain/presentationActivityRowSummaryIdentity.ts",
  import.meta.url
);
const activityEvidenceSummaryIdentityPath = new URL(
  "../services/domain/presentationActivityEvidenceSummaryIdentity.ts",
  import.meta.url
);

const summary = "Matched 3 similar delivery delays";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005YV pins Restaurant Memory evidence entry.summary to ASCII C", () => {
  assert.match(identitySource, /MISE-005YV/);
  assert.match(memorySource, /MISE-005YV/);

  assert.match(
    identitySource,
    /export function canonicalRestaurantMemoryEvidenceSummary\(value: string\) \{\s*return value\s*\.replace\(\/\\u00a0\/g, " "\)/
  );

  assert.match(
    memorySource,
    /from "\.\.\/\.\.\/services\/domain\/presentationRestaurantMemoryEvidenceSummaryIdentity"/
  );
  assert.match(memorySource, /normalizeRestaurantMemoryEvidenceSummary\(/);
  assert.match(
    memorySource,
    /normalizeRestaurantMemoryEvidenceSummary\(entry\.summary\)\s*\|\|\s*t\("memory\.evidence\.summary\.none"\)/
  );
  assert.doesNotMatch(memorySource, /evidenceLine[^>]*>\s*\{entry\.summary\}/);

  assert.match(catalogSource, /"memory\.evidence\.summary\.none": "Evidence details"/);
  assert.match(
    catalogSource,
    /"memory\.evidence\.summary\.none": "Detalles de la evidencia"/
  );
  assert.match(catalogSource, /"memory\.evidence\.summary\.none": "证据详情"/);

  // Leave restaurant-memory statement as raw pass-through on this tip (#830 owns domain statement).
  assert.match(memorySource, /\{memory\.statement\}/);

  // Leave Activity expanded evidence.summary as raw pass-through (next inventing candidate).
  assert.match(
    activitySource,
    /\{evidence\.type\.replace\(\/_\/g, " "\)\} — \{evidence\.summary\}/
  );

  assert.doesNotMatch(memorySource, /restaurantMemoryStatementIdentity/);
  assert.doesNotMatch(memorySource, /presentationActivityRowSummaryIdentity/);
  assert.doesNotMatch(memorySource, /normalizeActivityRowSummary/);
  assert.doesNotMatch(activitySource, /presentationRestaurantMemoryEvidenceSummaryIdentity/);
  assert.doesNotMatch(activitySource, /normalizeRestaurantMemoryEvidenceSummary/);
  assert.equal(
    (() => {
      try {
        readFileSync(restaurantMemoryStatementIdentityPath, "utf8");
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
        readFileSync(activityEvidenceSummaryIdentityPath, "utf8");
        return "present";
      } catch {
        return "absent";
      }
    })(),
    "absent"
  );

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /restaurantMemoryStatementIdentity/);
  assert.doesNotMatch(identityCode, /presentationActivityRowSummaryIdentity/);
  assert.doesNotMatch(identityCode, /presentationActivityEvidenceSummaryIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyBriefBoardExplanationIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeRestaurantMemoryEvidenceSummary(summary), summary);
  assert.equal(normalizeRestaurantMemoryEvidenceSummary(` ${summary} `), summary);
  assert.equal(
    normalizeRestaurantMemoryEvidenceSummary(`Conteo: ${summary}`),
    `Conteo: ${summary}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Restaurant Memory evidence summaries", () => {
  const padded = `${em}${summary}${em}`;
  const nbspSummary = `${nbsp}${summary}${nbsp}`;
  const internalEm = `Matched${em}3 similar delivery delays`;
  const internalNbsp = `Matched${nbsp}3 similar delivery delays`;
  const multiline = `Matched 3 similar delivery delays.\nReview supplier reliability before ordering.`;

  // Inventing proof: Unicode trim would invent the clean evidence summary.
  assert.equal(padded.trim(), summary);
  assert.equal(nbspSummary.trim(), summary);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspSummary), true);

  // ASCII C prep refuses that inventing equality for em-space padding.
  assert.equal(canonicalRestaurantMemoryEvidenceSummary(padded), padded);
  assert.equal(normalizeRestaurantMemoryEvidenceSummary(padded), null);
  assert.equal(normalizeRestaurantMemoryEvidenceSummary(padded) || "FALLBACK", "FALLBACK");

  // End NBSP folds to plain space then C-trims to the clean summary (durable
  // fold). Em-space end padding soft-nulls so display cannot invent equality.
  assert.equal(normalizeRestaurantMemoryEvidenceSummary(nbspSummary), summary);

  // Internal Unicode spaces: em-space preserved; NBSP folded to plain space.
  assert.equal(normalizeRestaurantMemoryEvidenceSummary(internalEm), internalEm);
  assert.equal(
    normalizeRestaurantMemoryEvidenceSummary(internalNbsp),
    "Matched 3 similar delivery delays"
  );
  assert.equal(normalizeRestaurantMemoryEvidenceSummary(multiline), multiline);
});

test("soft empty, controls, and non-strings fail closed for Restaurant Memory evidence summaries", () => {
  assert.equal(normalizeRestaurantMemoryEvidenceSummary(undefined), null);
  assert.equal(normalizeRestaurantMemoryEvidenceSummary(null), null);
  assert.equal(normalizeRestaurantMemoryEvidenceSummary(""), null);
  assert.equal(normalizeRestaurantMemoryEvidenceSummary("   "), null);
  assert.equal(normalizeRestaurantMemoryEvidenceSummary(123 as unknown as string), null);
  assert.equal(normalizeRestaurantMemoryEvidenceSummary(`\u0001${summary}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeRestaurantMemoryEvidenceSummary(`${summary}\t`), summary);
  assert.equal(normalizeRestaurantMemoryEvidenceSummary(`${summary}\u0007`), null);
  assert.equal(normalizeRestaurantMemoryEvidenceSummary(em), null);
  // Internal LF/TAB/CR remain allowed (operator_note multiline allowlist).
  assert.equal(
    normalizeRestaurantMemoryEvidenceSummary(`Matched 3\tsimilar delivery delays`),
    `Matched 3\tsimilar delivery delays`
  );
});

test("Restaurant Memory evidence bypass proof: empty and Unicode-only-space summaries soft-null to localized none", () => {
  // Prior always-pass-summary path still rendered blank-looking evidence Text.
  assert.equal(normalizeRestaurantMemoryEvidenceSummary(""), null);
  assert.equal(normalizeRestaurantMemoryEvidenceSummary(em), null);
  assert.equal(normalizeRestaurantMemoryEvidenceSummary(nbsp), null);
  assert.match(
    memorySource,
    /normalizeRestaurantMemoryEvidenceSummary\(entry\.summary\)\s*\|\|\s*t\("memory\.evidence\.summary\.none"\)/
  );
});

test("Restaurant Memory evidence entry.summary identity refuses Unicode inventing equality", () => {
  const padded = `${em}${summary}${em}`;
  assert.notEqual(canonicalRestaurantMemoryEvidenceSummary(padded), padded.trim());
  assert.equal(normalizeRestaurantMemoryEvidenceSummary(padded), null);
  assert.equal(normalizeRestaurantMemoryEvidenceSummary(`\t${summary}\n`), summary);
});

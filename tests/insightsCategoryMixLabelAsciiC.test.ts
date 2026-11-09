import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInsightsCategoryMixLabel,
  canonicalizeInsightsCategoryMixLabel,
  normalizeInsightsCategoryMixLabel
} from "../services/domain/presentationInsightsCategoryMixLabelIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationInsightsCategoryMixLabelIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const insightsSource = readFileSync(
  new URL("../app/(tabs)/insights.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const insightsSalesLabelIdentityPath = new URL(
  "../services/domain/insightsSalesLabelIdentity.ts",
  import.meta.url
);
const bestSellersItemNameIdentityPath = new URL(
  "../services/domain/presentationInsightsBestSellersItemNameIdentity.ts",
  import.meta.url
);
const sourceMixLabelIdentityPath = new URL(
  "../services/domain/presentationInsightsSourceMixLabelIdentity.ts",
  import.meta.url
);

const categoryLabel = "Mains";
const em = "\u2003";
const nbsp = "\u00a0";

function filePresence(path: URL) {
  try {
    readFileSync(path, "utf8");
    return "present";
  } catch {
    return "absent";
  }
}

test("MISE-005AAT pins Insights analytics categoryMix slice.label to ASCII C", () => {
  assert.match(identitySource, /MISE-005AAT/);
  assert.match(insightsSource, /MISE-005AAT/);

  assert.match(
    identitySource,
    /export function asciiTrimInsightsCategoryMixLabel\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    insightsSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationInsightsCategoryMixLabelIdentity"/
  );
  assert.match(insightsSource, /normalizeInsightsCategoryMixLabel\(/);
  assert.match(
    insightsSource,
    /normalizeInsightsCategoryMixLabel\(slice\.label\)/
  );
  assert.match(
    insightsSource,
    /t\("insights\.analytics\.categoryMix\.label\.none"\)/
  );

  assert.match(
    catalogSource,
    /"insights\.analytics\.categoryMix\.label\.none": "Uncategorized"/
  );

  // Leave sibling aggregation / best-sellers / sourceMix tips alone.
  assert.doesNotMatch(insightsSource, /normalizeInsightsBestSellersItemName/);
  assert.doesNotMatch(insightsSource, /normalizeInsightsSalesLabel/);
  assert.doesNotMatch(insightsSource, /normalizeInsightsSourceMixLabel/);
  assert.doesNotMatch(identitySource, /presentationInsightsBestSellersItemNameIdentity/);
  assert.doesNotMatch(identitySource, /insightsSalesLabelIdentity/);
  assert.doesNotMatch(identitySource, /presentationInsightsSourceMixLabelIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.equal(filePresence(insightsSalesLabelIdentityPath), "absent");
  assert.equal(filePresence(bestSellersItemNameIdentityPath), "absent");
  assert.equal(filePresence(sourceMixLabelIdentityPath), "absent");

  // sourceMix remains on the prior localizeMixLabel always-pass path.
  assert.match(
    insightsSource,
    /sourceMix\.map\(\(slice, index\) => \(\{\s*label: localizeMixLabel\(slice\.label, t\)/
  );

  assert.equal(normalizeInsightsCategoryMixLabel(categoryLabel), categoryLabel);
  assert.equal(normalizeInsightsCategoryMixLabel(` ${categoryLabel} `), categoryLabel);
  assert.equal(
    normalizeInsightsCategoryMixLabel(`Categoría ${categoryLabel}`),
    `Categoría ${categoryLabel}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Insights categoryMix labels", () => {
  const padded = `${em}${categoryLabel}${em}`;
  const nbspName = `${nbsp}${categoryLabel}${nbsp}`;
  const internalEm = `Ma${em}ins`;
  const internalNbsp = `Ma${nbsp}ins`;

  // Inventing proof: Unicode trim would invent the clean category label.
  assert.equal(padded.trim(), categoryLabel);
  assert.equal(nbspName.trim(), categoryLabel);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // Prior always-pass localizeMixLabel path would still render blank-looking /
  // padded category identity into DonutChart legend chrome.
  assert.equal(Boolean(padded.trim()), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimInsightsCategoryMixLabel(padded), padded);
  assert.equal(canonicalizeInsightsCategoryMixLabel(padded), null);
  assert.equal(canonicalizeInsightsCategoryMixLabel(nbspName), null);
  assert.equal(normalizeInsightsCategoryMixLabel(padded), null);
  assert.equal(normalizeInsightsCategoryMixLabel(nbspName), null);
  assert.equal(normalizeInsightsCategoryMixLabel(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeInsightsCategoryMixLabel(internalEm), internalEm);
  assert.equal(normalizeInsightsCategoryMixLabel(internalNbsp), internalNbsp);
  assert.equal(normalizeInsightsCategoryMixLabel(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Insights categoryMix labels", () => {
  assert.equal(normalizeInsightsCategoryMixLabel(undefined), null);
  assert.equal(normalizeInsightsCategoryMixLabel(null), null);
  assert.equal(normalizeInsightsCategoryMixLabel(""), null);
  assert.equal(normalizeInsightsCategoryMixLabel("   "), null);
  assert.equal(normalizeInsightsCategoryMixLabel(123 as unknown as string), null);
  assert.equal(normalizeInsightsCategoryMixLabel(`\u0001${categoryLabel}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeInsightsCategoryMixLabel(`${categoryLabel}\t`), categoryLabel);
  assert.equal(normalizeInsightsCategoryMixLabel(`${categoryLabel}\u0007`), null);
  assert.equal(normalizeInsightsCategoryMixLabel(em), null);
});

test("Insights categoryMix label bypass proof: empty and Unicode-only-space soft-null to localized none", () => {
  // Prior always-pass localizeMixLabel path still rendered blank-looking
  // category identity into Insights category-mix DonutChart legend chrome.
  assert.equal(normalizeInsightsCategoryMixLabel(""), null);
  assert.equal(normalizeInsightsCategoryMixLabel(em), null);
  assert.equal(normalizeInsightsCategoryMixLabel(nbsp), null);
  assert.match(
    insightsSource,
    /categoryLabel\s*\?\s*localizeMixLabel\(categoryLabel, t\)\s*:\s*t\("insights\.analytics\.categoryMix\.label\.none"\)/
  );
});

test("Insights categoryMix label identity refuses Unicode inventing equality", () => {
  const padded = `${em}${categoryLabel}${em}`;
  assert.notEqual(asciiTrimInsightsCategoryMixLabel(padded), padded.trim());
  assert.equal(normalizeInsightsCategoryMixLabel(padded), null);
  assert.equal(normalizeInsightsCategoryMixLabel(`\t${categoryLabel}\n`), categoryLabel);
});

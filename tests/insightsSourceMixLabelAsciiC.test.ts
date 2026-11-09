import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInsightsSourceMixLabel,
  canonicalizeInsightsSourceMixLabel,
  normalizeInsightsSourceMixLabel
} from "../services/domain/presentationInsightsSourceMixLabelIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationInsightsSourceMixLabelIdentity.ts",
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

const sourceLabel = "Square";
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

test("MISE-005AAS pins Insights analytics sourceMix slice.label to ASCII C", () => {
  assert.match(identitySource, /MISE-005AAS/);
  assert.match(insightsSource, /MISE-005AAS/);

  assert.match(
    identitySource,
    /export function asciiTrimInsightsSourceMixLabel\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    insightsSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationInsightsSourceMixLabelIdentity"/
  );
  assert.match(insightsSource, /normalizeInsightsSourceMixLabel\(/);
  assert.match(
    insightsSource,
    /normalizeInsightsSourceMixLabel\(slice\.label\)/
  );
  assert.match(
    insightsSource,
    /t\("insights\.analytics\.sourceMix\.label\.none"\)/
  );

  assert.match(catalogSource, /"insights\.analytics\.sourceMix\.label\.none": "POS"/);

  // Leave sibling aggregation / best-sellers / categoryMix tips alone.
  assert.doesNotMatch(insightsSource, /normalizeInsightsBestSellersItemName/);
  assert.doesNotMatch(insightsSource, /normalizeInsightsSalesLabel/);
  assert.doesNotMatch(identitySource, /presentationInsightsBestSellersItemNameIdentity/);
  assert.doesNotMatch(identitySource, /insightsSalesLabelIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.equal(filePresence(insightsSalesLabelIdentityPath), "absent");
  assert.equal(filePresence(bestSellersItemNameIdentityPath), "absent");

  // categoryMix remains on the prior localizeMixLabel always-pass path.
  assert.match(
    insightsSource,
    /categoryMix\.map\(\(slice, index\) => \(\{\s*label: localizeMixLabel\(slice\.label, t\)/
  );

  assert.equal(normalizeInsightsSourceMixLabel(sourceLabel), sourceLabel);
  assert.equal(normalizeInsightsSourceMixLabel(` ${sourceLabel} `), sourceLabel);
  assert.equal(
    normalizeInsightsSourceMixLabel(`Fuente ${sourceLabel}`),
    `Fuente ${sourceLabel}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Insights sourceMix labels", () => {
  const padded = `${em}${sourceLabel}${em}`;
  const nbspName = `${nbsp}${sourceLabel}${nbsp}`;
  const internalEm = `Squ${em}are`;
  const internalNbsp = `Squ${nbsp}are`;

  // Inventing proof: Unicode trim would invent the clean source label.
  assert.equal(padded.trim(), sourceLabel);
  assert.equal(nbspName.trim(), sourceLabel);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // Prior always-pass localizeMixLabel path would still render blank-looking /
  // padded source identity into DonutChart legend chrome.
  assert.equal(Boolean(padded.trim()), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimInsightsSourceMixLabel(padded), padded);
  assert.equal(canonicalizeInsightsSourceMixLabel(padded), null);
  assert.equal(canonicalizeInsightsSourceMixLabel(nbspName), null);
  assert.equal(normalizeInsightsSourceMixLabel(padded), null);
  assert.equal(normalizeInsightsSourceMixLabel(nbspName), null);
  assert.equal(normalizeInsightsSourceMixLabel(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeInsightsSourceMixLabel(internalEm), internalEm);
  assert.equal(normalizeInsightsSourceMixLabel(internalNbsp), internalNbsp);
  assert.equal(normalizeInsightsSourceMixLabel(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Insights sourceMix labels", () => {
  assert.equal(normalizeInsightsSourceMixLabel(undefined), null);
  assert.equal(normalizeInsightsSourceMixLabel(null), null);
  assert.equal(normalizeInsightsSourceMixLabel(""), null);
  assert.equal(normalizeInsightsSourceMixLabel("   "), null);
  assert.equal(normalizeInsightsSourceMixLabel(123 as unknown as string), null);
  assert.equal(normalizeInsightsSourceMixLabel(`\u0001${sourceLabel}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeInsightsSourceMixLabel(`${sourceLabel}\t`), sourceLabel);
  assert.equal(normalizeInsightsSourceMixLabel(`${sourceLabel}\u0007`), null);
  assert.equal(normalizeInsightsSourceMixLabel(em), null);
});

test("Insights sourceMix label bypass proof: empty and Unicode-only-space soft-null to localized none", () => {
  // Prior always-pass localizeMixLabel path still rendered blank-looking
  // source identity into Insights POS source-mix DonutChart legend chrome.
  assert.equal(normalizeInsightsSourceMixLabel(""), null);
  assert.equal(normalizeInsightsSourceMixLabel(em), null);
  assert.equal(normalizeInsightsSourceMixLabel(nbsp), null);
  assert.match(
    insightsSource,
    /sourceLabel\s*\?\s*localizeMixLabel\(sourceLabel, t\)\s*:\s*t\("insights\.analytics\.sourceMix\.label\.none"\)/
  );
});

test("Insights sourceMix label identity refuses Unicode inventing equality", () => {
  const padded = `${em}${sourceLabel}${em}`;
  assert.notEqual(asciiTrimInsightsSourceMixLabel(padded), padded.trim());
  assert.equal(normalizeInsightsSourceMixLabel(padded), null);
  assert.equal(normalizeInsightsSourceMixLabel(`\t${sourceLabel}\n`), sourceLabel);
});

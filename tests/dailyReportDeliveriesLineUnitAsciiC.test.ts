import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDailyReportDeliveriesLineUnit,
  canonicalizeDailyReportDeliveriesLineUnit,
  normalizeDailyReportDeliveriesLineUnit
} from "../services/domain/presentationDailyReportDeliveriesLineUnitIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationDailyReportDeliveriesLineUnitIdentity.ts", import.meta.url),
  "utf8"
);
const dailyReportSource = readFileSync(
  new URL("../app/more/daily-report.tsx", import.meta.url),
  "utf8"
);
const deliveriesItemNameIdentityPath = new URL(
  "../services/domain/presentationDailyReportDeliveriesLineItemNameIdentity.ts",
  import.meta.url
);
const inventoryHubUnitIdentityPath = new URL(
  "../services/domain/presentationInventoryHubUnitIdentity.ts",
  import.meta.url
);
const recommendationSuggestedUnitIdentityPath = new URL(
  "../services/domain/presentationRecommendationDecisionRowSuggestedUnitIdentity.ts",
  import.meta.url
);

const unit = "cs";
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

test("MISE-005AAJ pins Daily Report deliveries.line.unit to ASCII C", () => {
  assert.match(identitySource, /MISE-005AAJ/);
  assert.match(dailyReportSource, /MISE-005AAJ/);

  assert.match(
    identitySource,
    /export function asciiTrimDailyReportDeliveriesLineUnit\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    dailyReportSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationDailyReportDeliveriesLineUnitIdentity"/
  );
  assert.match(dailyReportSource, /normalizeDailyReportDeliveriesLineUnit\(/);
  assert.match(dailyReportSource, /deliveriesLineDisplayUnit/);
  assert.match(
    dailyReportSource,
    /deliveriesLineDisplayUnit \? ` \$\{deliveriesLineDisplayUnit\}` : ""/
  );
  assert.doesNotMatch(dailyReportSource, /line\.unit \? ` \$\{line\.unit\}` : ""/);

  // Leave sibling deliveries.line itemName / inventory unit tips alone.
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportDeliveriesLineItemName/);
  assert.doesNotMatch(dailyReportSource, /normalizeInventoryHubUnit/);
  assert.doesNotMatch(dailyReportSource, /normalizeRecommendationDecisionRowSuggestedUnit/);
  assert.doesNotMatch(identitySource, /presentationDailyReportDeliveriesLineItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryHubUnitIdentity/);
  assert.doesNotMatch(identitySource, /presentationRecommendationDecisionRowSuggestedUnitIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.equal(filePresence(deliveriesItemNameIdentityPath), "absent");
  assert.equal(filePresence(inventoryHubUnitIdentityPath), "absent");
  assert.equal(filePresence(recommendationSuggestedUnitIdentityPath), "absent");

  // Leave deliveries.line itemName raw for open #1065.
  assert.match(dailyReportSource, /item:\s*line\.itemName/);

  assert.equal(normalizeDailyReportDeliveriesLineUnit(unit), unit);
  assert.equal(normalizeDailyReportDeliveriesLineUnit(` ${unit} `), unit);
  assert.equal(normalizeDailyReportDeliveriesLineUnit(`case ${unit}`), `case ${unit}`);
});

test("Unicode padding invents via trim and is soft-nulled for Daily Report deliveries.line units", () => {
  const padded = `${em}${unit}${em}`;
  const nbspName = `${nbsp}${unit}${nbsp}`;
  const internalEm = `c${em}s`;
  const internalNbsp = `c${nbsp}s`;

  // Inventing proof: Unicode trim would invent the clean unit.
  assert.equal(padded.trim(), unit);
  assert.equal(nbspName.trim(), unit);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // Prior always-pass truthy gate would still render blank-looking / padded unit.
  assert.equal(Boolean(padded.trim()), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimDailyReportDeliveriesLineUnit(padded), padded);
  assert.equal(canonicalizeDailyReportDeliveriesLineUnit(padded), null);
  assert.equal(canonicalizeDailyReportDeliveriesLineUnit(nbspName), null);
  assert.equal(normalizeDailyReportDeliveriesLineUnit(padded), null);
  assert.equal(normalizeDailyReportDeliveriesLineUnit(nbspName), null);
  assert.equal(normalizeDailyReportDeliveriesLineUnit(padded) || "", "");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeDailyReportDeliveriesLineUnit(internalEm), internalEm);
  assert.equal(normalizeDailyReportDeliveriesLineUnit(internalNbsp), internalNbsp);
  assert.equal(normalizeDailyReportDeliveriesLineUnit(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Daily Report deliveries.line units", () => {
  assert.equal(normalizeDailyReportDeliveriesLineUnit(undefined), null);
  assert.equal(normalizeDailyReportDeliveriesLineUnit(null), null);
  assert.equal(normalizeDailyReportDeliveriesLineUnit(""), null);
  assert.equal(normalizeDailyReportDeliveriesLineUnit("   "), null);
  assert.equal(normalizeDailyReportDeliveriesLineUnit(123 as unknown as string), null);
  assert.equal(normalizeDailyReportDeliveriesLineUnit(`\u0001${unit}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeDailyReportDeliveriesLineUnit(`${unit}\t`), unit);
  assert.equal(normalizeDailyReportDeliveriesLineUnit(`${unit}\u0007`), null);
  assert.equal(normalizeDailyReportDeliveriesLineUnit(em), null);
});

test("Daily Report deliveries.line unit bypass proof: empty and Unicode-only-space soft-null to omit", () => {
  // Prior always-pass truthy path still rendered blank-looking unit in qty
  // copy (`"12  "`). Soft-null restores quantity-only omit.
  assert.equal(normalizeDailyReportDeliveriesLineUnit(""), null);
  assert.equal(normalizeDailyReportDeliveriesLineUnit(em), null);
  assert.equal(normalizeDailyReportDeliveriesLineUnit(nbsp), null);
  assert.match(
    dailyReportSource,
    /deliveriesLineDisplayUnit \? ` \$\{deliveriesLineDisplayUnit\}` : ""/
  );
  assert.match(
    dailyReportSource,
    /normalizeDailyReportDeliveriesLineUnit\(\s*line\.unit\s*\)/
  );
});

test("Daily Report deliveries.line unit identity refuses Unicode inventing equality", () => {
  const padded = `${em}${unit}${em}`;
  assert.notEqual(asciiTrimDailyReportDeliveriesLineUnit(padded), padded.trim());
  assert.equal(normalizeDailyReportDeliveriesLineUnit(padded), null);
  assert.equal(normalizeDailyReportDeliveriesLineUnit(`\t${unit}\n`), unit);
});

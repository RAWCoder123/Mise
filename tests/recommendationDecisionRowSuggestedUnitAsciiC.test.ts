import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimRecommendationDecisionRowSuggestedUnit,
  canonicalizeRecommendationDecisionRowSuggestedUnit,
  normalizeRecommendationDecisionRowSuggestedUnit
} from "../services/domain/presentationRecommendationDecisionRowSuggestedUnitIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationRecommendationDecisionRowSuggestedUnitIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const rowSource = readFileSync(
  new URL("../components/RecommendationDecisionRow.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const itemNameIdentityPath = new URL(
  "../services/domain/presentationRecommendationDecisionRowItemNameIdentity.ts",
  import.meta.url
);
const reasonIdentityPath = new URL(
  "../services/domain/presentationRecommendationDecisionRowReasonIdentity.ts",
  import.meta.url
);
const hubUnitIdentityPath = new URL(
  "../services/domain/presentationInventoryHubUnitIdentity.ts",
  import.meta.url
);
const detailUnitIdentityPath = new URL(
  "../services/domain/presentationInventoryDetailUnitIdentity.ts",
  import.meta.url
);
const scanItemQuantityUnitIdentityPath = new URL(
  "../services/domain/presentationScanItemQuantityUnitIdentity.ts",
  import.meta.url
);
const inventoryUnitsPath = new URL("../services/domain/inventoryUnits.ts", import.meta.url);

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

test("MISE-005AAI pins RecommendationDecisionRow suggested unit to ASCII C", () => {
  assert.match(identitySource, /MISE-005AAI/);
  assert.match(rowSource, /MISE-005AAI/);

  assert.match(
    identitySource,
    /export function asciiTrimRecommendationDecisionRowSuggestedUnit\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    rowSource,
    /from "\.\.\/services\/domain\/presentationRecommendationDecisionRowSuggestedUnitIdentity"/
  );
  assert.match(rowSource, /normalizeRecommendationDecisionRowSuggestedUnit\(/);
  assert.match(
    rowSource,
    /normalizeRecommendationDecisionRowSuggestedUnit\(\s*recommendation\.unit\s*\)\s*\|\|\s*t\("orders\.recommendation\.unit\.none"\)/
  );
  assert.match(rowSource, /suggestedDisplayUnit/);
  assert.match(
    rowSource,
    /t\("orders\.recommendation\.suggested", \{\s*quantity: suggestedQuantity,\s*unit: suggestedDisplayUnit\s*\}\)/
  );
  assert.doesNotMatch(
    rowSource,
    /t\("orders\.recommendation\.suggested", \{\s*quantity: suggestedQuantity,\s*unit: recommendation\.unit\s*\}\)/
  );
  assert.doesNotMatch(rowSource, /styles\.unit\}>\{recommendation\.unit\}/);
  assert.match(
    rowSource,
    /quantityReadOnlyAccessibility", \{\s*item: recommendation\.item_name,\s*quantity,\s*unit: suggestedDisplayUnit\s*\}/
  );

  assert.match(catalogSource, /"orders\.recommendation\.unit\.none": "unit"/);
  assert.match(catalogSource, /"orders\.recommendation\.unit\.none": "unidad"/);
  assert.match(catalogSource, /"orders\.recommendation\.unit\.none": "单位"/);

  // Leave sibling RecommendationDecisionRow item_name / reason and hub+detail /
  // Scan Item unit tips alone.
  assert.doesNotMatch(rowSource, /normalizeRecommendationDecisionRowItemName/);
  assert.doesNotMatch(rowSource, /normalizeRecommendationDecisionRowReason/);
  assert.doesNotMatch(rowSource, /normalizeInventoryHubUnit/);
  assert.doesNotMatch(rowSource, /normalizeInventoryDetailUnit/);
  assert.doesNotMatch(rowSource, /normalizeScanItemQuantityUnit/);
  assert.doesNotMatch(identitySource, /presentationRecommendationDecisionRowItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationRecommendationDecisionRowReasonIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryHubUnitIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryDetailUnitIdentity/);
  assert.doesNotMatch(identitySource, /presentationScanItemQuantityUnitIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*inventoryUnits/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.equal(filePresence(itemNameIdentityPath), "absent");
  assert.equal(filePresence(reasonIdentityPath), "absent");
  assert.equal(filePresence(hubUnitIdentityPath), "absent");
  assert.equal(filePresence(detailUnitIdentityPath), "absent");
  assert.equal(filePresence(scanItemQuantityUnitIdentityPath), "absent");
  assert.equal(filePresence(inventoryUnitsPath), "present");

  // Leave RecommendationDecisionRow item_name / reason display paths alone.
  assert.match(rowSource, /styles\.itemName\}>\{recommendation\.item_name\}/);
  assert.match(rowSource, /styles\.reason\}>\{recommendation\.reason\}/);
  assert.match(
    rowSource,
    /orders\.recommendation\.reason\.(show|hide)Accessibility",\s*\{\s*item: recommendation\.item_name\s*\}/
  );
  assert.match(
    rowSource,
    /orders\.recommendation\.approveAccessibility", \{\s*item: recommendation\.item_name\s*\}/
  );

  assert.equal(normalizeRecommendationDecisionRowSuggestedUnit(unit), unit);
  assert.equal(normalizeRecommendationDecisionRowSuggestedUnit(` ${unit} `), unit);
  assert.equal(
    normalizeRecommendationDecisionRowSuggestedUnit(`case ${unit}`),
    `case ${unit}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for RecommendationDecisionRow suggested units", () => {
  const padded = `${em}${unit}${em}`;
  const nbspName = `${nbsp}${unit}${nbsp}`;
  const internalEm = `c${em}s`;
  const internalNbsp = `c${nbsp}s`;

  // Inventing proof: Unicode trim would invent the clean unit.
  assert.equal(padded.trim(), unit);
  assert.equal(nbspName.trim(), unit);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimRecommendationDecisionRowSuggestedUnit(padded), padded);
  assert.equal(canonicalizeRecommendationDecisionRowSuggestedUnit(padded), null);
  assert.equal(canonicalizeRecommendationDecisionRowSuggestedUnit(nbspName), null);
  assert.equal(normalizeRecommendationDecisionRowSuggestedUnit(padded), null);
  assert.equal(normalizeRecommendationDecisionRowSuggestedUnit(nbspName), null);
  assert.equal(
    normalizeRecommendationDecisionRowSuggestedUnit(padded) || "FALLBACK",
    "FALLBACK"
  );

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeRecommendationDecisionRowSuggestedUnit(internalEm), internalEm);
  assert.equal(normalizeRecommendationDecisionRowSuggestedUnit(internalNbsp), internalNbsp);
  assert.equal(normalizeRecommendationDecisionRowSuggestedUnit(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for RecommendationDecisionRow suggested units", () => {
  assert.equal(normalizeRecommendationDecisionRowSuggestedUnit(undefined), null);
  assert.equal(normalizeRecommendationDecisionRowSuggestedUnit(null), null);
  assert.equal(normalizeRecommendationDecisionRowSuggestedUnit(""), null);
  assert.equal(normalizeRecommendationDecisionRowSuggestedUnit("   "), null);
  assert.equal(
    normalizeRecommendationDecisionRowSuggestedUnit(123 as unknown as string),
    null
  );
  assert.equal(normalizeRecommendationDecisionRowSuggestedUnit(`\u0001${unit}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeRecommendationDecisionRowSuggestedUnit(`${unit}\t`), unit);
  assert.equal(normalizeRecommendationDecisionRowSuggestedUnit(`${unit}\u0007`), null);
  assert.equal(normalizeRecommendationDecisionRowSuggestedUnit(em), null);
});

test("RecommendationDecisionRow suggested unit bypass proof: empty and Unicode-only-space units soft-null to localized none", () => {
  // Prior always-pass-name path still rendered blank-looking unit in suggested
  // copy (`"Suggested 12  "`) and beside the quantity control.
  assert.equal(normalizeRecommendationDecisionRowSuggestedUnit(""), null);
  assert.equal(normalizeRecommendationDecisionRowSuggestedUnit(em), null);
  assert.equal(normalizeRecommendationDecisionRowSuggestedUnit(nbsp), null);
  assert.match(
    rowSource,
    /normalizeRecommendationDecisionRowSuggestedUnit\(\s*recommendation\.unit\s*\)\s*\|\|\s*t\("orders\.recommendation\.unit\.none"\)/
  );
  assert.match(rowSource, /suggestedDisplayUnit/);
  assert.match(rowSource, /styles\.unit\}>\{suggestedDisplayUnit\}/);
});

test("RecommendationDecisionRow suggested unit identity refuses Unicode inventing equality", () => {
  const padded = `${em}${unit}${em}`;
  assert.notEqual(
    asciiTrimRecommendationDecisionRowSuggestedUnit(padded),
    padded.trim()
  );
  assert.equal(normalizeRecommendationDecisionRowSuggestedUnit(padded), null);
  assert.equal(normalizeRecommendationDecisionRowSuggestedUnit(`\t${unit}\n`), unit);
});

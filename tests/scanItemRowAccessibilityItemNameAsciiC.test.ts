import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimScanItemRowAccessibilityItemName,
  canonicalizeScanItemRowAccessibilityItemName,
  normalizeScanItemRowAccessibilityItemName
} from "../services/domain/presentationScanItemRowAccessibilityItemNameIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationScanItemRowAccessibilityItemNameIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const scanItemSource = readFileSync(
  new URL("../app/more/scan-item.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const itemName = "Roma Tomatoes";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005ABP pins Scan Item row a11y item.item_name to ASCII C", () => {
  assert.match(identitySource, /MISE-005ABP/);
  assert.match(scanItemSource, /MISE-005ABP/);

  assert.match(
    identitySource,
    /export function asciiTrimScanItemRowAccessibilityItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    scanItemSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationScanItemRowAccessibilityItemNameIdentity"/
  );
  assert.match(scanItemSource, /normalizeScanItemRowAccessibilityItemName\(/);
  assert.match(
    scanItemSource,
    /normalizeScanItemRowAccessibilityItemName\(item\.item_name\)\s*\|\|\s*\n?\s*t\("scanItem\.row\.accessibility\.item\.none"\)/
  );
  assert.doesNotMatch(
    scanItemSource,
    /accessibilityLabel=\{t\("scanItem\.row\.accessibility", \{ item: item\.item_name \}\)/
  );

  assert.match(catalogSource, /"scanItem\.row\.accessibility\.item\.none": "Item"/);
  assert.match(catalogSource, /"scanItem\.row\.accessibility\.item\.none": "Artículo"/);
  assert.match(catalogSource, /"scanItem\.row\.accessibility\.item\.none": "商品"/);

  // Leave OperationalRow title display and sibling tips alone.
  assert.match(scanItemSource, /title=\{item\.item_name\}/);
  assert.doesNotMatch(identitySource, /presentationScanItemRowItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationLogDeliveryRowItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationLogDeliveryItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationWasteActionReviewItemNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeScanItemRowAccessibilityItemName(itemName), itemName);
  assert.equal(normalizeScanItemRowAccessibilityItemName(` ${itemName} `), itemName);
  assert.equal(
    normalizeScanItemRowAccessibilityItemName(`Case-${itemName}`),
    `Case-${itemName}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Scan Item row a11y names", () => {
  const padded = `${em}${itemName}${em}`;
  const nbspName = `${nbsp}${itemName}${nbsp}`;
  const internalEm = `Roma${em}Tomatoes`;
  const internalNbsp = `Roma${nbsp}Tomatoes`;

  // Inventing proof: Unicode trim would invent the clean item name.
  assert.equal(padded.trim(), itemName);
  assert.equal(nbspName.trim(), itemName);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimScanItemRowAccessibilityItemName(padded), padded);
  assert.equal(canonicalizeScanItemRowAccessibilityItemName(padded), null);
  assert.equal(canonicalizeScanItemRowAccessibilityItemName(nbspName), null);
  assert.equal(normalizeScanItemRowAccessibilityItemName(padded), null);
  assert.equal(normalizeScanItemRowAccessibilityItemName(nbspName), null);
  assert.equal(normalizeScanItemRowAccessibilityItemName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeScanItemRowAccessibilityItemName(internalEm), internalEm);
  assert.equal(normalizeScanItemRowAccessibilityItemName(internalNbsp), internalNbsp);
  assert.equal(normalizeScanItemRowAccessibilityItemName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Scan Item row a11y names", () => {
  assert.equal(normalizeScanItemRowAccessibilityItemName(undefined), null);
  assert.equal(normalizeScanItemRowAccessibilityItemName(null), null);
  assert.equal(normalizeScanItemRowAccessibilityItemName(""), null);
  assert.equal(normalizeScanItemRowAccessibilityItemName("   "), null);
  assert.equal(normalizeScanItemRowAccessibilityItemName(123 as unknown as string), null);
  assert.equal(normalizeScanItemRowAccessibilityItemName(`\u0001${itemName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeScanItemRowAccessibilityItemName(`${itemName}\t`), itemName);
  assert.equal(normalizeScanItemRowAccessibilityItemName(`${itemName}\u0007`), null);
  assert.equal(normalizeScanItemRowAccessibilityItemName(em), null);
});

test("Scan Item row a11y bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-pass path still interpolated blank-looking item into a11y.
  assert.equal(normalizeScanItemRowAccessibilityItemName(""), null);
  assert.equal(normalizeScanItemRowAccessibilityItemName(em), null);
  assert.equal(normalizeScanItemRowAccessibilityItemName(nbsp), null);
  const missingName: string | null | undefined = undefined;
  const unicodeOnlyName: string | null | undefined = em;
  assert.equal(missingName ?? "", "");
  assert.equal(unicodeOnlyName ?? "", em);
  assert.notEqual(unicodeOnlyName ?? "", "");
  assert.equal(Boolean(unicodeOnlyName), true);
  assert.match(
    scanItemSource,
    /normalizeScanItemRowAccessibilityItemName\(item\.item_name\)\s*\|\|\s*\n?\s*t\("scanItem\.row\.accessibility\.item\.none"\)/
  );
});

test("Scan Item row a11y item.item_name identity refuses Unicode inventing equality", () => {
  const padded = `${em}${itemName}${em}`;
  assert.notEqual(asciiTrimScanItemRowAccessibilityItemName(padded), padded.trim());
  assert.equal(normalizeScanItemRowAccessibilityItemName(padded), null);
  assert.equal(normalizeScanItemRowAccessibilityItemName(`\t${itemName}\n`), itemName);
});

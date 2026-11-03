import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimAutonomyRuleSupplierName,
  canonicalizeAutonomyRuleSupplierName,
  normalizeAutonomyRuleSupplierName
} from "../services/domain/presentationAutonomyRuleSupplierNameIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationAutonomyRuleSupplierNameIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const autonomySource = readFileSync(
  new URL("../app/settings/autonomy.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const supplierName = "Sysco";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005XF pins Autonomy rule supplierName to ASCII C", () => {
  assert.match(identitySource, /MISE-005XF/);
  assert.match(autonomySource, /MISE-005XF/);

  assert.match(
    identitySource,
    /export function asciiTrimAutonomyRuleSupplierName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    autonomySource,
    /from "\.\.\/\.\.\/services\/domain\/presentationAutonomyRuleSupplierNameIdentity"/
  );
  assert.match(autonomySource, /normalizeAutonomyRuleSupplierName\(/);
  assert.match(
    autonomySource,
    /normalizeAutonomyRuleSupplierName\(rule\.supplierName\)\s*\|\|\s*\n?\s*t\("autonomy\.field\.supplier\.none"\)/
  );

  assert.match(catalogSource, /"autonomy\.field\.supplier\.none": "—"/);
  // ES / zh-Hans keep the same intentional none marker (typographic dash).
  assert.equal(
    (catalogSource.match(/"autonomy\.field\.supplier\.none": "—"/g) ?? []).length,
    3
  );

  // Leave sibling tips alone.
  assert.doesNotMatch(autonomySource, /normalizeAutonomySubtitleRestaurantName/);
  assert.doesNotMatch(autonomySource, /normalizeSettingsSuppliers/);
  assert.doesNotMatch(autonomySource, /normalizeDailyReportSupplier/);
  assert.doesNotMatch(autonomySource, /normalizeOrdersReviewSupplierName/);
  assert.doesNotMatch(autonomySource, /normalizeInventoryDetailSupplierName/);
  assert.doesNotMatch(identitySource, /presentationAutonomySubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationSettingsSuppliers/);
  assert.doesNotMatch(identitySource, /presentationOrdersReviewSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  // Prior inventing / bypass path must be gone.
  assert.doesNotMatch(autonomySource, /rule\.supplierName\s*\?\?\s*"—"/);

  // Subtitle restaurant.name path remains for the sibling tip / main baseline.
  assert.match(autonomySource, /restaurant\.name/);

  assert.equal(normalizeAutonomyRuleSupplierName(supplierName), supplierName);
  assert.equal(normalizeAutonomyRuleSupplierName(` ${supplierName} `), supplierName);
  assert.equal(
    normalizeAutonomyRuleSupplierName(`Artículo ${supplierName}`),
    `Artículo ${supplierName}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Autonomy rule supplier names", () => {
  const padded = `${em}${supplierName}${em}`;
  const nbspName = `${nbsp}${supplierName}${nbsp}`;
  const internalEm = `Sys${em}co`;
  const internalNbsp = `Sys${nbsp}co`;

  // Inventing proof: Unicode trim would invent the clean supplier name.
  assert.equal(padded.trim(), supplierName);
  assert.equal(nbspName.trim(), supplierName);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);
  // Non-nullish `??` bypass proof: Unicode-only space and empty string skip "—".
  const maybePadded: string | null | undefined = padded;
  const maybeEmpty: string | null | undefined = "";
  const maybeEm: string | null | undefined = em;
  assert.equal(maybePadded ?? "—", padded);
  assert.equal(maybeEmpty ?? "—", "");
  assert.equal(maybeEm ?? "—", em);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimAutonomyRuleSupplierName(padded), padded);
  assert.equal(canonicalizeAutonomyRuleSupplierName(padded), null);
  assert.equal(canonicalizeAutonomyRuleSupplierName(nbspName), null);
  assert.equal(normalizeAutonomyRuleSupplierName(padded), null);
  assert.equal(normalizeAutonomyRuleSupplierName(nbspName), null);
  assert.equal(normalizeAutonomyRuleSupplierName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeAutonomyRuleSupplierName(internalEm), internalEm);
  assert.equal(normalizeAutonomyRuleSupplierName(internalNbsp), internalNbsp);
  assert.equal(normalizeAutonomyRuleSupplierName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Autonomy rule supplier names", () => {
  assert.equal(normalizeAutonomyRuleSupplierName(undefined), null);
  assert.equal(normalizeAutonomyRuleSupplierName(null), null);
  assert.equal(normalizeAutonomyRuleSupplierName(""), null);
  assert.equal(normalizeAutonomyRuleSupplierName("   "), null);
  assert.equal(normalizeAutonomyRuleSupplierName(123 as unknown as string), null);
  assert.equal(normalizeAutonomyRuleSupplierName(`\u0001${supplierName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeAutonomyRuleSupplierName(`${supplierName}\t`), supplierName);
  assert.equal(normalizeAutonomyRuleSupplierName(`${supplierName}\u0007`), null);
  assert.equal(normalizeAutonomyRuleSupplierName(em), null);
});

test("Autonomy Supplier scope bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior `?? "—"` path still rendered blank-looking supplier identity
  // into the Supplier scope ReadOnlyField for non-nullish empty / padding.
  assert.equal(normalizeAutonomyRuleSupplierName(""), null);
  assert.equal(normalizeAutonomyRuleSupplierName(em), null);
  assert.equal(normalizeAutonomyRuleSupplierName(nbsp), null);
  assert.match(
    autonomySource,
    /normalizeAutonomyRuleSupplierName\(rule\.supplierName\)\s*\|\|\s*\n?\s*t\("autonomy\.field\.supplier\.none"\)/
  );
});

test("Autonomy rule supplierName identity refuses Unicode inventing equality", () => {
  const padded = `${em}${supplierName}${em}`;
  assert.notEqual(asciiTrimAutonomyRuleSupplierName(padded), padded.trim());
  assert.equal(normalizeAutonomyRuleSupplierName(padded), null);
  assert.equal(normalizeAutonomyRuleSupplierName(`\t${supplierName}\n`), supplierName);
});

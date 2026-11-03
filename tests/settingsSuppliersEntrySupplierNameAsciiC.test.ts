import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSettingsSuppliersEntrySupplierName,
  canonicalizeSettingsSuppliersEntrySupplierName,
  normalizeSettingsSuppliersEntrySupplierName
} from "../services/domain/presentationSettingsSuppliersEntrySupplierNameIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationSettingsSuppliersEntrySupplierNameIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const screenSource = readFileSync(
  new URL("../app/settings/suppliers.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const supplierName = "Sysco";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005WT pins Settings suppliers entry.supplierName to ASCII C", () => {
  assert.match(identitySource, /MISE-005WT/);
  assert.match(screenSource, /MISE-005WT/);

  assert.match(
    identitySource,
    /export function asciiTrimSettingsSuppliersEntrySupplierName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    screenSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationSettingsSuppliersEntrySupplierNameIdentity"/
  );
  assert.match(screenSource, /normalizeSettingsSuppliersEntrySupplierName\(/);
  assert.match(
    screenSource,
    /normalizeSettingsSuppliersEntrySupplierName\(entry\.supplierName\)\s*\|\|\s*t\("settings\.suppliers\.supplierName\.none"\)/
  );
  assert.doesNotMatch(
    screenSource,
    /<Text style=\{styles\.supplierName\} numberOfLines=\{2\}>\{entry\.supplierName\}<\/Text>/
  );

  assert.match(catalogSource, /"settings\.suppliers\.supplierName\.none": "Supplier"/);
  assert.match(catalogSource, /"settings\.suppliers\.supplierName\.none": "Proveedor"/);
  assert.match(catalogSource, /"settings\.suppliers\.supplierName\.none": "供应商"/);

  // Leave sibling supplier_name / rename-prep / email tips alone on this tip.
  assert.doesNotMatch(screenSource, /normalizeInventoryDetailSupplierName/);
  assert.doesNotMatch(screenSource, /normalizeOrdersReviewSupplierName/);
  assert.doesNotMatch(screenSource, /normalizeSupplierDraftCardSupplierName/);
  assert.doesNotMatch(screenSource, /normalizeDailyReportSupplierName/);
  assert.doesNotMatch(screenSource, /canonicalSupplierSettingsDisplayName/);
  assert.doesNotMatch(screenSource, /canonicalSupplierDisplayName/);
  assert.doesNotMatch(identitySource, /presentationInventoryDetailSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationOrdersReviewSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationSupplierDraftCardSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationDailyReportSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /supplierSettingsNameIdentity/);
  assert.doesNotMatch(identitySource, /supplierDisplayNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  // Leave rename prep, draft seeding, and email paths on raw entry fields.
  assert.match(screenSource, /function canonicalSupplierName\(/);
  assert.match(
    screenSource,
    /const draftName = draftNames\[key\] \?\? entry\.supplierName;/
  );
  assert.match(
    screenSource,
    /const nameUnchanged = canonicalSupplierName\(draftName\) === entry\.supplierName;/
  );
  assert.match(screenSource, /entry\.email \?\? copy\.notConfigured/);

  assert.equal(normalizeSettingsSuppliersEntrySupplierName(supplierName), supplierName);
  assert.equal(normalizeSettingsSuppliersEntrySupplierName(` ${supplierName} `), supplierName);
  assert.equal(
    normalizeSettingsSuppliersEntrySupplierName(`Proveedor ${supplierName}`),
    `Proveedor ${supplierName}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Settings suppliers entry names", () => {
  const padded = `${em}${supplierName}${em}`;
  const nbspName = `${nbsp}${supplierName}${nbsp}`;
  const internalEm = `Sys${em}co`;
  const internalNbsp = `Sys${nbsp}co`;

  // Inventing proof: Unicode trim would invent the clean supplier name.
  assert.equal(padded.trim(), supplierName);
  assert.equal(nbspName.trim(), supplierName);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSettingsSuppliersEntrySupplierName(padded), padded);
  assert.equal(canonicalizeSettingsSuppliersEntrySupplierName(padded), null);
  assert.equal(canonicalizeSettingsSuppliersEntrySupplierName(nbspName), null);
  assert.equal(normalizeSettingsSuppliersEntrySupplierName(padded), null);
  assert.equal(normalizeSettingsSuppliersEntrySupplierName(nbspName), null);
  assert.equal(normalizeSettingsSuppliersEntrySupplierName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSettingsSuppliersEntrySupplierName(internalEm), internalEm);
  assert.equal(normalizeSettingsSuppliersEntrySupplierName(internalNbsp), internalNbsp);
  assert.equal(normalizeSettingsSuppliersEntrySupplierName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Settings suppliers entry names", () => {
  assert.equal(normalizeSettingsSuppliersEntrySupplierName(undefined), null);
  assert.equal(normalizeSettingsSuppliersEntrySupplierName(null), null);
  assert.equal(normalizeSettingsSuppliersEntrySupplierName(""), null);
  assert.equal(normalizeSettingsSuppliersEntrySupplierName("   "), null);
  assert.equal(normalizeSettingsSuppliersEntrySupplierName(123 as unknown as string), null);
  assert.equal(normalizeSettingsSuppliersEntrySupplierName(`\u0001${supplierName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeSettingsSuppliersEntrySupplierName(`${supplierName}\t`), supplierName);
  assert.equal(normalizeSettingsSuppliersEntrySupplierName(`${supplierName}\u0007`), null);
  assert.equal(normalizeSettingsSuppliersEntrySupplierName(em), null);
});

test("Settings suppliers bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-pass-name path still rendered blank-looking supplier identity
  // on the directory supplierName Text and a11y / notice interpolations.
  assert.equal(normalizeSettingsSuppliersEntrySupplierName(""), null);
  assert.equal(normalizeSettingsSuppliersEntrySupplierName(em), null);
  assert.equal(normalizeSettingsSuppliersEntrySupplierName(nbsp), null);
  assert.match(
    screenSource,
    /normalizeSettingsSuppliersEntrySupplierName\(entry\.supplierName\)\s*\|\|\s*t\("settings\.suppliers\.supplierName\.none"\)/
  );
});

test("Settings suppliers entry supplier-name identity refuses Unicode inventing equality", () => {
  const padded = `${em}${supplierName}${em}`;
  assert.notEqual(asciiTrimSettingsSuppliersEntrySupplierName(padded), padded.trim());
  assert.equal(normalizeSettingsSuppliersEntrySupplierName(padded), null);
  assert.equal(normalizeSettingsSuppliersEntrySupplierName(`\t${supplierName}\n`), supplierName);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSetupSupplierNameText,
  canonicalizeSetupSupplierNameText,
  prepareSetupSupplierNameText
} from "../services/domain/setupSupplierNamesIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/setupSupplierNamesIdentity.ts", import.meta.url),
  "utf8"
);
const setupSource = readFileSync(new URL("../app/(auth)/setup.tsx", import.meta.url), "utf8");
const applicationSetupSource = readFileSync(
  new URL("../services/application/setup.ts", import.meta.url),
  "utf8"
);

const supplierName = "Fresh Poultry";
const accentedName = "Café Produce";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005RR pins setup supplierNames draft identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005RR/);
  assert.match(setupSource, /MISE-005RR/);

  assert.match(
    identitySource,
    /export function asciiTrimSetupSupplierNameText\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    setupSource,
    /from "\.\.\/\.\.\/services\/domain\/setupSupplierNamesIdentity"/
  );
  assert.match(setupSource, /prepareSetupSupplierNameText\(/);
  assert.match(setupSource, /collectSetupSupplierNames\(/);
  assert.doesNotMatch(
    setupSource,
    /const supplierNames = suppliers\.map\(\(supplier\) => supplier\.name\.trim\(\)\)\.filter\(Boolean\);/
  );
  assert.match(setupSource, /const supplierNames = collectSetupSupplierNames\(suppliers\);/);

  // Leave duplicate/email bare trim for open #696 / MISE-005KA.
  assert.match(
    setupSource,
    /const name = supplier\.name\.trim\(\)\.replace\(\/\\s\+\/g, " "\);/
  );
  assert.match(setupSource, /const email = supplier\.email\.trim\(\);/);
  assert.match(setupSource, /toLocaleLowerCase\("en-US"\)/);
  assert.doesNotMatch(setupSource, /canonicalSetupScreenSupplierDisplayName\(/);
  assert.doesNotMatch(setupSource, /setupScreenSupplierIdentity/);

  // Leave chip label / supplier_count / inventory supplier emptiness on bare trim.
  assert.match(
    setupSource,
    /const label = supplier\.name\.trim\(\) \|\| t\("setup\.validation\.supplierLabel"/
  );
  assert.match(
    setupSource,
    /supplier_count: suppliers\.filter\(\(supplier\) => supplier\.name\.trim\(\)\)\.length/
  );
  assert.match(
    setupSource,
    /suppliers\.some\(\(supplier\) => supplier\.id === item\.supplierId && supplier\.name\.trim\(\)\)/
  );

  // Leave inventoryItemNames Unicode trim alone (open #903 / MISE-005RQ).
  assert.match(
    setupSource,
    /const inventoryItemNames = normalizedInventoryItems\.map\(\(item\) => item\.name\.trim\(\)\)\.filter\(Boolean\);/
  );
  assert.doesNotMatch(setupSource, /prepareSetupInventoryItemNameText\(/);
  assert.doesNotMatch(setupSource, /setupInventoryItemNameIdentity/);

  // Leave application setup supplier.trim alone (open #680 / MISE-005JK).
  assert.match(applicationSetupSource, /supplier\.name\.trim\(\)/);
  assert.doesNotMatch(applicationSetupSource, /setupSupplierNamesIdentity/);
  assert.doesNotMatch(applicationSetupSource, /prepareSetupSupplierNameText\(/);
  assert.doesNotMatch(applicationSetupSource, /collectSetupSupplierNames\(/);

  // Do not rewrite sibling tips through this module.
  assert.doesNotMatch(identitySource, /prepareSetupInventoryItemNameText/);
  assert.doesNotMatch(identitySource, /canonicalSetupScreenSupplierDisplayName/);
  assert.doesNotMatch(identitySource, /normalizeSetupSupplierNameKey/);
  assert.doesNotMatch(identitySource, /requireBoundedStringArray/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupInventoryItemNameIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupScreenSupplierIdentity["']/);
  assert.doesNotMatch(
    identitySource,
    /from ["']\.\/operationalProfileArrayEntryIdentity["']/
  );
  assert.doesNotMatch(
    setupSource,
    /from "\.\.\/\.\.\/services\/domain\/setupInventoryItemNameIdentity"/
  );
  assert.doesNotMatch(
    setupSource,
    /from "\.\.\/\.\.\/services\/domain\/setupScreenSupplierIdentity"/
  );
  assert.doesNotMatch(
    setupSource,
    /from "\.\.\/\.\.\/services\/domain\/operationalProfileArrayEntryIdentity"/
  );
});

test("ASCII trim keeps ordinary setup supplier names stable", () => {
  assert.equal(asciiTrimSetupSupplierNameText(`  ${supplierName}  `), supplierName);
  assert.equal(asciiTrimSetupSupplierNameText(`\t${supplierName}\n`), supplierName);
  assert.deepEqual(canonicalizeSetupSupplierNameText(`  ${supplierName}  `), {
    status: "ok",
    text: supplierName
  });
  assert.deepEqual(prepareSetupSupplierNameText(`  ${supplierName}  `), {
    status: "ok",
    text: supplierName
  });
  assert.deepEqual(prepareSetupSupplierNameText(accentedName), {
    status: "ok",
    text: accentedName
  });
  assert.deepEqual(prepareSetupSupplierNameText("Restaurant Depot"), {
    status: "ok",
    text: "Restaurant Depot"
  });

  // Soft empty stays empty (prior supplier.name.trim() filter skip).
  assert.deepEqual(prepareSetupSupplierNameText("   "), { status: "empty" });
  assert.deepEqual(prepareSetupSupplierNameText("\t\n"), { status: "empty" });
  assert.deepEqual(prepareSetupSupplierNameText(""), { status: "empty" });
});

test("NBSP and em-space padding cannot invent a clean setup supplier name", () => {
  const nbspName = `${nbsp}${supplierName}${nbsp}`;
  const emName = `${em}${supplierName}${em}`;

  // Live inventing proof on Unicode trim (what supplier.name.trim(), demo
  // supplierNames, and hosted primarySuppliers previously did).
  assert.equal(nbspName.trim(), supplierName);
  assert.equal(emName.trim(), supplierName);
  assert.equal(em.trim(), "");

  assert.deepEqual(canonicalizeSetupSupplierNameText(nbspName), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeSetupSupplierNameText(emName), {
    status: "invalid"
  });
  assert.deepEqual(prepareSetupSupplierNameText(nbspName), {
    status: "invalid"
  });
  assert.deepEqual(prepareSetupSupplierNameText(emName), {
    status: "invalid"
  });

  // Soft empty Unicode-only padding falls through like prior filter skip,
  // and must not invent an ok draft from a padded name.
  assert.deepEqual(prepareSetupSupplierNameText(`${em}${em}`), {
    status: "empty"
  });
  assert.deepEqual(prepareSetupSupplierNameText(`${nbsp}${nbsp}`), {
    status: "empty"
  });
  assert.notDeepEqual(prepareSetupSupplierNameText(emName), {
    status: "empty"
  });
  assert.notDeepEqual(prepareSetupSupplierNameText(emName), {
    status: "ok",
    text: supplierName
  });

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.deepEqual(prepareSetupSupplierNameText(`Fresh${em}Poultry`), {
    status: "ok",
    text: `Fresh${em}Poultry`
  });
  assert.deepEqual(prepareSetupSupplierNameText(`Fresh${nbsp}Poultry`), {
    status: "ok",
    text: `Fresh${nbsp}Poultry`
  });
});

test("ASCII controls and non-string setup supplier name drafts fail closed without inventing", () => {
  assert.deepEqual(canonicalizeSetupSupplierNameText("Fresh\nPoultry"), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeSetupSupplierNameText("Fresh\rPoultry"), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeSetupSupplierNameText("Fresh\x01Poultry"), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeSetupSupplierNameText("Fresh\x7fPoultry"), {
    status: "invalid"
  });
  assert.deepEqual(prepareSetupSupplierNameText("Fresh\nPoultry"), {
    status: "invalid"
  });
  assert.deepEqual(prepareSetupSupplierNameText("Fresh\x7fPoultry"), {
    status: "invalid"
  });

  assert.deepEqual(prepareSetupSupplierNameText(null), { status: "invalid" });
  assert.deepEqual(prepareSetupSupplierNameText(undefined), {
    status: "invalid"
  });
  assert.deepEqual(prepareSetupSupplierNameText(12), { status: "invalid" });
});

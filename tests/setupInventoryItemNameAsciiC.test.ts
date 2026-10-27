import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSetupInventoryItemNameText,
  canonicalizeSetupInventoryItemNameText,
  prepareSetupInventoryItemNameText
} from "../services/domain/setupInventoryItemNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/setupInventoryItemNameIdentity.ts", import.meta.url),
  "utf8"
);
const setupSource = readFileSync(new URL("../app/(auth)/setup.tsx", import.meta.url), "utf8");
const applicationSetupSource = readFileSync(
  new URL("../services/application/setup.ts", import.meta.url),
  "utf8"
);

const itemName = "Tomato";
const accentedName = "Café";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005RQ pins setup inventory item name draft identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005RQ/);
  assert.match(setupSource, /MISE-005RQ/);

  assert.match(
    identitySource,
    /export function asciiTrimSetupInventoryItemNameText\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    setupSource,
    /from "\.\.\/\.\.\/services\/domain\/setupInventoryItemNameIdentity"/
  );
  assert.match(setupSource, /prepareSetupInventoryItemNameText\(/);
  assert.match(setupSource, /normalizeSetupInventoryItemName\(/);
  assert.match(setupSource, /name: normalizeSetupInventoryItemName\(item\.name\)/);
  assert.doesNotMatch(
    setupSource,
    /const inventoryItemNames = normalizedInventoryItems\.map\(\(item\) => item\.name\.trim\(\)\)\.filter\(Boolean\);/
  );
  assert.match(
    setupSource,
    /const inventoryItemNames = normalizedInventoryItems\.map\(\(item\) => item\.name\)\.filter\(Boolean\);/
  );
  assert.doesNotMatch(
    setupSource,
    /const label = item\.name\.trim\(\) \|\| t\("setup\.validation\.inventoryLabel"/
  );
  assert.doesNotMatch(
    setupSource,
    /if \(!item\.name\.trim\(\)\) return setupValidationFailure\("inventory", t\("setup\.validation\.needsName"/
  );

  // Leave hasDraftData emptiness on the prior bare item.name.trim contract.
  assert.match(
    setupSource,
    /item\.name\.trim\(\) \|\| item\.quantity\.trim\(\) \|\| item\.parLevel\.trim\(\) \|\| item\.supplierId/
  );

  // Leave setup inventory quantity on the prior bare contract (open #895).
  assert.match(
    setupSource,
    /if \(!item\.quantity\.trim\(\)\) return setupValidationFailure\("inventory", t\("setup\.validation\.needsQuantity"/
  );
  assert.match(setupSource, /quantity: normalizeDraftNumber\(item\.quantity, parseNumber\)/);
  assert.doesNotMatch(setupSource, /prepareSetupInventoryQuantityText\(/);
  assert.doesNotMatch(setupSource, /setupInventoryQuantityIdentity/);

  // Leave setup inventory parLevel on the prior bare contract (open #894).
  assert.match(setupSource, /parLevel: normalizeDraftNumber\(item\.parLevel, parseNumber\)/);
  assert.doesNotMatch(setupSource, /prepareSetupInventoryParLevelText\(/);
  assert.doesNotMatch(setupSource, /setupInventoryParLevelIdentity/);

  // Leave setup inventory unit on the prior bare trim emptiness gate.
  assert.match(setupSource, /if \(!item\.unit\.trim\(\)\) return setupValidationFailure\("inventory"/);

  // Leave supplierNames Unicode trim alone (open #680 / later tip).
  assert.match(
    setupSource,
    /const supplierNames = suppliers\.map\(\(supplier\) => supplier\.name\.trim\(\)\)\.filter\(Boolean\);/
  );

  // Leave application draft.name.trim alone (open #679 / MISE-005JJ).
  assert.match(applicationSetupSource, /const itemName = draft\.name\.trim\(\);/);
  assert.doesNotMatch(applicationSetupSource, /setupInventoryItemNameIdentity/);
  assert.doesNotMatch(applicationSetupSource, /prepareSetupInventoryItemNameText\(/);
  assert.doesNotMatch(applicationSetupSource, /normalizeSetupInventoryItemName\(/);

  // Leave recipe ingredient itemName tips alone on this screen.
  assert.match(setupSource, /ingredient\.itemName\.trim\(\)/);
  assert.doesNotMatch(setupSource, /prepareSetupRecipeIngredientItemNameText\(/);
  assert.doesNotMatch(setupSource, /setupRecipeIngredientItemNameIdentity/);
  assert.doesNotMatch(setupSource, /setupRecipeIngredientItemNameSaveIdentity/);

  // Do not rewrite sibling tips through this module.
  assert.doesNotMatch(identitySource, /prepareSetupInventoryQuantityText/);
  assert.doesNotMatch(identitySource, /prepareSetupInventoryParLevelText/);
  assert.doesNotMatch(identitySource, /prepareSetupRecipeIngredientItemNameText/);
  assert.doesNotMatch(identitySource, /normalizeCanonicalSetupRecipeIngredientItemNameSave/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupInventoryQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupInventoryParLevelIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupRecipeIngredientItemNameIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupRecipeIngredientItemNameSaveIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupInventoryUnitIdentity["']/);
  assert.doesNotMatch(
    setupSource,
    /from "\.\.\/\.\.\/services\/domain\/setupInventoryQuantityIdentity"/
  );
  assert.doesNotMatch(
    setupSource,
    /from "\.\.\/\.\.\/services\/domain\/setupInventoryParLevelIdentity"/
  );
  assert.doesNotMatch(
    setupSource,
    /from "\.\.\/\.\.\/services\/domain\/setupRecipeIngredientItemNameIdentity"/
  );
});

test("ASCII trim keeps ordinary setup inventory item names stable", () => {
  assert.equal(asciiTrimSetupInventoryItemNameText(`  ${itemName}  `), itemName);
  assert.equal(asciiTrimSetupInventoryItemNameText(`\t${itemName}\n`), itemName);
  assert.deepEqual(canonicalizeSetupInventoryItemNameText(`  ${itemName}  `), {
    status: "ok",
    text: itemName
  });
  assert.deepEqual(prepareSetupInventoryItemNameText(`  ${itemName}  `), {
    status: "ok",
    text: itemName
  });
  assert.deepEqual(prepareSetupInventoryItemNameText(accentedName), {
    status: "ok",
    text: accentedName
  });
  assert.deepEqual(prepareSetupInventoryItemNameText("San Marzano"), {
    status: "ok",
    text: "San Marzano"
  });

  // Soft empty stays empty (prior required item.name.trim() emptiness).
  assert.deepEqual(prepareSetupInventoryItemNameText("   "), { status: "empty" });
  assert.deepEqual(prepareSetupInventoryItemNameText("\t\n"), { status: "empty" });
  assert.deepEqual(prepareSetupInventoryItemNameText(""), { status: "empty" });
});

test("NBSP and em-space padding cannot invent a clean setup inventory item name", () => {
  const nbspName = `${nbsp}${itemName}${nbsp}`;
  const emName = `${em}${itemName}${em}`;

  // Live inventing proof on Unicode trim (what item.name.trim(), demo
  // inventoryItemNames, and application draft.name.trim() do).
  assert.equal(nbspName.trim(), itemName);
  assert.equal(emName.trim(), itemName);
  assert.equal(em.trim(), "");

  assert.deepEqual(canonicalizeSetupInventoryItemNameText(nbspName), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeSetupInventoryItemNameText(emName), {
    status: "invalid"
  });
  assert.deepEqual(prepareSetupInventoryItemNameText(nbspName), {
    status: "invalid"
  });
  assert.deepEqual(prepareSetupInventoryItemNameText(emName), {
    status: "invalid"
  });

  // Soft empty Unicode-only padding falls through like prior required emptiness,
  // and must not invent an ok draft from a padded name.
  assert.deepEqual(prepareSetupInventoryItemNameText(`${em}${em}`), {
    status: "empty"
  });
  assert.deepEqual(prepareSetupInventoryItemNameText(`${nbsp}${nbsp}`), {
    status: "empty"
  });
  assert.notDeepEqual(prepareSetupInventoryItemNameText(emName), {
    status: "empty"
  });
  assert.notDeepEqual(prepareSetupInventoryItemNameText(emName), {
    status: "ok",
    text: itemName
  });

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.deepEqual(prepareSetupInventoryItemNameText(`Tom${em}ato`), {
    status: "ok",
    text: `Tom${em}ato`
  });
  assert.deepEqual(prepareSetupInventoryItemNameText(`San${nbsp}Marzano`), {
    status: "ok",
    text: `San${nbsp}Marzano`
  });
});

test("ASCII controls and non-string setup inventory item name drafts fail closed without inventing", () => {
  assert.deepEqual(canonicalizeSetupInventoryItemNameText("Tom\nato"), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeSetupInventoryItemNameText("Tom\rato"), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeSetupInventoryItemNameText("Tom\x01ato"), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeSetupInventoryItemNameText("Tom\x7fato"), {
    status: "invalid"
  });
  assert.deepEqual(prepareSetupInventoryItemNameText("Tom\nato"), {
    status: "invalid"
  });
  assert.deepEqual(prepareSetupInventoryItemNameText("Tom\x7fato"), {
    status: "invalid"
  });

  assert.deepEqual(prepareSetupInventoryItemNameText(null), { status: "invalid" });
  assert.deepEqual(prepareSetupInventoryItemNameText(undefined), {
    status: "invalid"
  });
  assert.deepEqual(prepareSetupInventoryItemNameText(12), { status: "invalid" });
});

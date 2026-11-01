import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInventoryDetailItemName,
  canonicalizeInventoryDetailItemName,
  normalizeInventoryDetailItemName
} from "../services/domain/presentationInventoryDetailItemNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationInventoryDetailItemNameIdentity.ts", import.meta.url),
  "utf8"
);
const inventoryUiSource = readFileSync(
  new URL("../app/inventory/[id].tsx", import.meta.url),
  "utf8"
);

const itemName = "Roma Tomatoes";
const accentedItemName = "Café Beans";
const FALLBACK = "Inventory item";

test("MISE-005VI pins Inventory detail Screen title item_name to ASCII C", () => {
  assert.match(identitySource, /MISE-005VI/);
  assert.match(inventoryUiSource, /MISE-005VI/);

  assert.match(
    identitySource,
    /export function asciiTrimInventoryDetailItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.ok(identitySource.includes("/[\\u0000-\\u001f\\u007f]/"));
  // Single-line name tips preserve NBSP — do not fold into plain space.
  assert.ok(!identitySource.includes('.replace(/\\u00a0/g, " ")'));
  const trimFn = identitySource.slice(
    identitySource.indexOf("export function asciiTrimInventoryDetailItemName("),
    identitySource.indexOf("function hasControlCharacters(")
  );
  assert.doesNotMatch(trimFn, /\.trim\(\)/);
  assert.doesNotMatch(trimFn, /\\s/);
  assert.doesNotMatch(trimFn, /\.toLowerCase\(\)/);

  assert.match(
    inventoryUiSource,
    /normalizeInventoryDetailItemName\(item\?\.item_name\)\s*\|\|\s*t\("inventory\.detail\.title"\)/
  );
  assert.doesNotMatch(
    inventoryUiSource,
    /item\?\.item_name \?\? t\("inventory\.detail\.title"\)/
  );

  // Leave sibling tips / modules alone.
  assert.doesNotMatch(identitySource, /from ["'].*ordersDetailTitleSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*ordersDetailEmailReviewHeaderIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*ordersDetailEmailReviewBodyIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*ordersDetailNoteNoneIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*homeStatusApprovalTitleIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*presentationSetupFallbackLabelIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*presentationWasteItemNameIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*presentationGmailSenderEmailIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*presentationOrdersGmailSenderIdentity/);

  // Do not rewrite other item_name interpolations on this screen.
  assert.match(
    inventoryUiSource,
    /t\("inventory\.detail\.addAccessibility", \{\s*item: item\.item_name\s*\}\)/
  );
});

test("ASCII C title prep keeps ordinary item_name display stable", () => {
  assert.equal(asciiTrimInventoryDetailItemName(`  ${itemName}  `), itemName);
  assert.equal(asciiTrimInventoryDetailItemName(`\t${itemName}\n`), itemName);
  assert.equal(canonicalizeInventoryDetailItemName(`  ${itemName}  `), itemName);
  assert.equal(normalizeInventoryDetailItemName(`  ${itemName}  `), itemName);
  assert.equal(normalizeInventoryDetailItemName(accentedItemName), accentedItemName);
});

test("Unicode-only space and empty string bypass inventory.detail.title via ?? until ASCII C soft-null restores it", () => {
  const emOnly = "\u2003";
  const nbspOnly = "\u00a0";
  const paddedSpaces = "   ";
  const empty = "";

  // Prior `??` bypass proofs (weaker than `||`, but still skips title fallback).
  assert.equal(emOnly ?? FALLBACK, emOnly);
  assert.notEqual(emOnly ?? FALLBACK, FALLBACK);
  assert.equal(empty ?? FALLBACK, empty);
  assert.notEqual(empty ?? FALLBACK, FALLBACK);

  assert.equal(normalizeInventoryDetailItemName(emOnly), null);
  assert.equal(normalizeInventoryDetailItemName(emOnly) || FALLBACK, FALLBACK);
  assert.equal(normalizeInventoryDetailItemName(nbspOnly), null);
  assert.equal(normalizeInventoryDetailItemName(paddedSpaces), null);
  assert.equal(normalizeInventoryDetailItemName(empty), null);
  assert.equal(normalizeInventoryDetailItemName(null), null);
  assert.equal(normalizeInventoryDetailItemName(undefined), null);
  assert.equal(normalizeInventoryDetailItemName(null) || FALLBACK, FALLBACK);
});

test("NBSP/em-space padding cannot invent clean Inventory detail title item_name display", () => {
  const emName = `\u2003${itemName}\u2003`;
  const nbspName = `\u00a0${itemName}\u00a0`;

  // Inventing proof on Unicode trim.
  assert.equal(emName.trim(), itemName);
  assert.equal(nbspName.trim(), itemName);

  // Name tips preserve NBSP: ASCII trim leaves Unicode padding alone.
  assert.equal(asciiTrimInventoryDetailItemName(emName), emName);
  assert.equal(asciiTrimInventoryDetailItemName(nbspName), nbspName);

  // Soft-null refuses to invent clean item_name Screen title display.
  assert.equal(canonicalizeInventoryDetailItemName(emName), null);
  assert.equal(canonicalizeInventoryDetailItemName(nbspName), null);
  assert.equal(normalizeInventoryDetailItemName(emName), null);
  assert.equal(normalizeInventoryDetailItemName(nbspName), null);
  assert.equal(normalizeInventoryDetailItemName(emName) || FALLBACK, FALLBACK);
  assert.equal(normalizeInventoryDetailItemName(nbspName) || FALLBACK, FALLBACK);
});

test("Unsafe single-line controls soft-null for Inventory detail title item_name display", () => {
  assert.equal(normalizeInventoryDetailItemName(`${itemName}\u0000`), null);
  assert.equal(normalizeInventoryDetailItemName(`\u0007${itemName}`), null);
  assert.equal(normalizeInventoryDetailItemName(`${itemName}\u007f`), null);
  // Single-line titles reject embedded LF/CR (unlike multiline note/body tips).
  assert.equal(normalizeInventoryDetailItemName(`${itemName}\nnext`), null);
  assert.equal(normalizeInventoryDetailItemName(`${itemName}\rmore`), null);
  // Trailing ASCII whitespace still trims clean.
  assert.equal(normalizeInventoryDetailItemName(`${itemName}\t`), itemName);
  assert.equal(normalizeInventoryDetailItemName("Roma Tomatoes"), itemName);
});

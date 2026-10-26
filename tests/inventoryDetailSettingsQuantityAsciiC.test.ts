import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInventoryDetailSettingsQuantityText,
  canonicalizeInventoryDetailSettingsQuantityText,
  prepareInventoryDetailSettingsQuantityText
} from "../services/domain/inventoryDetailSettingsQuantityIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/inventoryDetailSettingsQuantityIdentity.ts", import.meta.url),
  "utf8"
);
const screenSource = readFileSync(new URL("../app/inventory/[id].tsx", import.meta.url), "utf8");
const countSource = readFileSync(new URL("../app/inventory/count.tsx", import.meta.url), "utf8");
const ordersSource = readFileSync(new URL("../app/(tabs)/orders.tsx", import.meta.url), "utf8");
const logDeliverySource = readFileSync(
  new URL("../app/more/log-delivery.tsx", import.meta.url),
  "utf8"
);
const formattersSource = readFileSync(new URL("../i18n/formatters.ts", import.meta.url), "utf8");

test("MISE-005RG pins inventory detail settings quantity draft identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005RG/);
  assert.match(screenSource, /MISE-005RG/);

  assert.match(
    identitySource,
    /export function asciiTrimInventoryDetailSettingsQuantityText\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    screenSource,
    /from "\.\.\/\.\.\/services\/domain\/inventoryDetailSettingsQuantityIdentity"/
  );
  assert.match(screenSource, /prepareInventoryDetailSettingsQuantityText\(/);
  assert.match(screenSource, /parseNumber\(preparedParLevel\.text\)/);
  assert.match(screenSource, /parseNumber\(preparedReorderThreshold\.text\)/);
  assert.doesNotMatch(
    screenSource,
    /par_level: parseNumber\(parLevel\) \?\? 0,/
  );
  assert.doesNotMatch(
    screenSource,
    /reorder_threshold: parseNumber\(reorderThreshold\) \?\? 0/
  );
  assert.doesNotMatch(screenSource, /function validateInventoryNumber\(/);
  assert.match(screenSource, /function validatePreparedInventorySettingsQuantity\(/);

  // Open #892 owns inventory detail operation quantityText; leave that path alone.
  assert.match(
    screenSource,
    /const quantity = operation === "stockout" \? 0 : parseNumber\(quantityText\);/
  );
  assert.match(screenSource, /validateOperationQuantity\(\s*quantityText,/);
  assert.doesNotMatch(screenSource, /prepareInventoryDetailQuantityText\(/);
  assert.doesNotMatch(screenSource, /inventoryDetailQuantityIdentity/);

  // Open #854 owns inventory-operation notes; leave note Unicode trim alone.
  assert.match(screenSource, /note: noteText\.trim\(\) \|\| undefined/);
  assert.doesNotMatch(screenSource, /canonicalizeInventoryOperationNote/);
  assert.doesNotMatch(screenSource, /inventoryOperationNoteIdentity/);

  // Leave inventory count draftCounts, Orders recommendation quantities, and
  // Log Delivery quantities on their existing contracts.
  assert.match(countSource, /draftCounts\[line\.inventory_item_id\]\?\.trim\(\)/);
  assert.match(ordersSource, /quantities\[recommendation\.id\]\?\.trim\(\)/);
  assert.match(logDeliverySource, /parseNumber\(quantityText\)/);

  // Live inventing substrate remains in locale parse; this tip refuses to feed
  // Unicode-padded drafts into it from inventory detail settings.
  assert.match(formattersSource, /const trimmed = input\.trim\(\);/);

  // Do not rewrite sibling tips through this module.
  assert.doesNotMatch(identitySource, /prepareInventoryDetailQuantityText/);
  assert.doesNotMatch(identitySource, /prepareLogDeliveryQuantityText/);
  assert.doesNotMatch(identitySource, /prepareOrdersRecommendationQuantityText/);
  assert.doesNotMatch(identitySource, /prepareInventoryCountQuantityText/);
  assert.doesNotMatch(identitySource, /canonicalizeInventoryOperationNote/);
  assert.doesNotMatch(identitySource, /from ["']\.\/inventoryDetailQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/logDeliveryQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/ordersRecommendationQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/inventoryCountQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/inventoryOperationNoteIdentity["']/);
  assert.doesNotMatch(
    screenSource,
    /from "\.\.\/\.\.\/services\/domain\/inventoryDetailQuantityIdentity"/
  );
  assert.doesNotMatch(
    screenSource,
    /from "\.\.\/\.\.\/services\/domain\/logDeliveryQuantityIdentity"/
  );
  assert.doesNotMatch(
    screenSource,
    /from "\.\.\/\.\.\/services\/domain\/inventoryCountQuantityIdentity"/
  );
  assert.doesNotMatch(
    screenSource,
    /from "\.\.\/\.\.\/services\/domain\/ordersRecommendationQuantityIdentity"/
  );
});

test("ASCII trim keeps ordinary inventory detail settings quantity drafts stable", () => {
  assert.equal(asciiTrimInventoryDetailSettingsQuantityText("  12  "), "12");
  assert.deepEqual(canonicalizeInventoryDetailSettingsQuantityText("\t12\n"), {
    status: "ok",
    text: "12"
  });
  assert.deepEqual(prepareInventoryDetailSettingsQuantityText("  12  "), {
    status: "ok",
    text: "12"
  });
  assert.deepEqual(prepareInventoryDetailSettingsQuantityText("0"), { status: "ok", text: "0" });
  assert.deepEqual(prepareInventoryDetailSettingsQuantityText("12.5"), {
    status: "ok",
    text: "12.5"
  });
  assert.deepEqual(prepareInventoryDetailSettingsQuantityText("1,234.5"), {
    status: "ok",
    text: "1,234.5"
  });
  assert.deepEqual(prepareInventoryDetailSettingsQuantityText("1.234,5"), {
    status: "ok",
    text: "1.234,5"
  });

  // Prior emptiness contract: ASCII-only whitespace softs to empty.
  assert.deepEqual(prepareInventoryDetailSettingsQuantityText("   "), { status: "empty" });
  assert.deepEqual(prepareInventoryDetailSettingsQuantityText("\t\n"), { status: "empty" });
  assert.deepEqual(prepareInventoryDetailSettingsQuantityText(""), { status: "empty" });
});

test("NBSP and em-space padding cannot invent a clean inventory detail settings quantity", () => {
  const amount = "12";
  const nbspAmount = `\u00a0${amount}\u00a0`;
  const emAmount = `\u2003${amount}\u2003`;

  // Live inventing proof on Unicode trim (what parseLocalizedNumber and
  // validateInventoryNumber emptiness do, and what inventory detail settings
  // previously fed unprepared).
  assert.equal(nbspAmount.trim(), amount);
  assert.equal(emAmount.trim(), amount);
  assert.equal("\u2003".trim(), "");

  assert.deepEqual(canonicalizeInventoryDetailSettingsQuantityText(nbspAmount), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeInventoryDetailSettingsQuantityText(emAmount), {
    status: "invalid"
  });
  assert.deepEqual(prepareInventoryDetailSettingsQuantityText(nbspAmount), {
    status: "invalid"
  });
  assert.deepEqual(prepareInventoryDetailSettingsQuantityText(emAmount), {
    status: "invalid"
  });

  // Soft empty Unicode-only padding falls through like prior field-required
  // emptiness, and must not invent an ok draft from a padded amount.
  assert.deepEqual(prepareInventoryDetailSettingsQuantityText("\u2003\u2003"), {
    status: "empty"
  });
  assert.deepEqual(prepareInventoryDetailSettingsQuantityText("\u00a0\u00a0"), {
    status: "empty"
  });
  assert.notDeepEqual(prepareInventoryDetailSettingsQuantityText(emAmount), {
    status: "empty"
  });
  assert.notDeepEqual(prepareInventoryDetailSettingsQuantityText(emAmount), {
    status: "ok",
    text: amount
  });
});

test("ASCII controls and non-string settings quantity drafts fail closed without inventing", () => {
  assert.deepEqual(canonicalizeInventoryDetailSettingsQuantityText("12\n3"), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeInventoryDetailSettingsQuantityText("12\r3"), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeInventoryDetailSettingsQuantityText("12\x013"), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeInventoryDetailSettingsQuantityText("12\x7f3"), {
    status: "invalid"
  });
  assert.deepEqual(prepareInventoryDetailSettingsQuantityText("12\n3"), { status: "invalid" });
  assert.deepEqual(prepareInventoryDetailSettingsQuantityText("12\x7f3"), {
    status: "invalid"
  });

  assert.deepEqual(prepareInventoryDetailSettingsQuantityText(null), { status: "invalid" });
  assert.deepEqual(prepareInventoryDetailSettingsQuantityText(undefined), {
    status: "invalid"
  });
  assert.deepEqual(prepareInventoryDetailSettingsQuantityText(12), { status: "invalid" });
});

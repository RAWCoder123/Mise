import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInventoryDetailQuantityText,
  canonicalizeInventoryDetailQuantityText,
  prepareInventoryDetailQuantityText
} from "../services/domain/inventoryDetailQuantityIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/inventoryDetailQuantityIdentity.ts", import.meta.url),
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

test("MISE-005RF pins inventory detail quantity draft identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005RF/);
  assert.match(screenSource, /MISE-005RF/);

  assert.match(
    identitySource,
    /export function asciiTrimInventoryDetailQuantityText\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    screenSource,
    /from "\.\.\/\.\.\/services\/domain\/inventoryDetailQuantityIdentity"/
  );
  assert.match(screenSource, /prepareInventoryDetailQuantityText\(/);
  assert.match(screenSource, /parseNumber\(prepared\.text\)/);
  assert.doesNotMatch(screenSource, /const quantity = operation === "stockout" \? 0 : parseNumber\(quantityText\);/);
  assert.doesNotMatch(
    screenSource,
    /validateOperationQuantity\(\s*quantityText,/
  );

  // Open #854 owns inventory-operation notes; leave note Unicode trim alone.
  assert.match(screenSource, /note: noteText\.trim\(\) \|\| undefined/);
  assert.doesNotMatch(screenSource, /canonicalizeInventoryOperationNote/);
  assert.doesNotMatch(screenSource, /inventoryOperationNoteIdentity/);

  // Leave inventory detail settings fields on their existing Unicode-trim contract.
  assert.match(screenSource, /validateInventoryNumber\(/);
  assert.match(
    screenSource,
    /function validateInventoryNumber\([\s\S]*?if \(!value\.trim\(\)\)/
  );

  // Leave inventory count draftCounts, Orders recommendation quantities, and
  // Log Delivery quantities on their existing contracts.
  assert.match(countSource, /draftCounts\[line\.inventory_item_id\]\?\.trim\(\)/);
  assert.match(ordersSource, /quantities\[recommendation\.id\]\?\.trim\(\)/);
  assert.match(logDeliverySource, /parseNumber\(quantityText\)/);

  // Live inventing substrate remains in locale parse; this tip refuses to feed
  // Unicode-padded drafts into it from inventory detail operations.
  assert.match(formattersSource, /const trimmed = input\.trim\(\);/);

  // Do not rewrite sibling tips through this module.
  assert.doesNotMatch(identitySource, /prepareLogDeliveryQuantityText/);
  assert.doesNotMatch(identitySource, /prepareOrdersRecommendationQuantityText/);
  assert.doesNotMatch(identitySource, /prepareInventoryCountQuantityText/);
  assert.doesNotMatch(identitySource, /canonicalizeInventoryOperationNote/);
  assert.doesNotMatch(identitySource, /from ["']\.\/logDeliveryQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/ordersRecommendationQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/inventoryCountQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/inventoryOperationNoteIdentity["']/);
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

test("ASCII trim keeps ordinary inventory detail quantity drafts stable", () => {
  assert.equal(asciiTrimInventoryDetailQuantityText("  12  "), "12");
  assert.deepEqual(canonicalizeInventoryDetailQuantityText("\t12\n"), {
    status: "ok",
    text: "12"
  });
  assert.deepEqual(prepareInventoryDetailQuantityText("  12  "), {
    status: "ok",
    text: "12"
  });
  assert.deepEqual(prepareInventoryDetailQuantityText("0"), { status: "ok", text: "0" });
  assert.deepEqual(prepareInventoryDetailQuantityText("12.5"), {
    status: "ok",
    text: "12.5"
  });
  assert.deepEqual(prepareInventoryDetailQuantityText("1,234.5"), {
    status: "ok",
    text: "1,234.5"
  });
  assert.deepEqual(prepareInventoryDetailQuantityText("1.234,5"), {
    status: "ok",
    text: "1.234,5"
  });

  // Prior emptiness contract: ASCII-only whitespace softs to empty.
  assert.deepEqual(prepareInventoryDetailQuantityText("   "), { status: "empty" });
  assert.deepEqual(prepareInventoryDetailQuantityText("\t\n"), { status: "empty" });
  assert.deepEqual(prepareInventoryDetailQuantityText(""), { status: "empty" });
});

test("NBSP and em-space padding cannot invent a clean inventory detail quantity", () => {
  const amount = "12";
  const nbspAmount = `\u00a0${amount}\u00a0`;
  const emAmount = `\u2003${amount}\u2003`;

  // Live inventing proof on Unicode trim (what parseLocalizedNumber and
  // validateOperationQuantity emptiness do, and what inventory detail
  // previously fed unprepared).
  assert.equal(nbspAmount.trim(), amount);
  assert.equal(emAmount.trim(), amount);
  assert.equal("\u2003".trim(), "");

  assert.deepEqual(canonicalizeInventoryDetailQuantityText(nbspAmount), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeInventoryDetailQuantityText(emAmount), {
    status: "invalid"
  });
  assert.deepEqual(prepareInventoryDetailQuantityText(nbspAmount), { status: "invalid" });
  assert.deepEqual(prepareInventoryDetailQuantityText(emAmount), { status: "invalid" });

  // Soft empty Unicode-only padding falls through like prior field-required
  // emptiness, and must not invent an ok draft from a padded amount.
  assert.deepEqual(prepareInventoryDetailQuantityText("\u2003\u2003"), { status: "empty" });
  assert.deepEqual(prepareInventoryDetailQuantityText("\u00a0\u00a0"), { status: "empty" });
  assert.notDeepEqual(prepareInventoryDetailQuantityText(emAmount), { status: "empty" });
  assert.notDeepEqual(prepareInventoryDetailQuantityText(emAmount), {
    status: "ok",
    text: amount
  });
});

test("ASCII controls and non-string quantity drafts fail closed without inventing", () => {
  assert.deepEqual(canonicalizeInventoryDetailQuantityText("12\n3"), { status: "invalid" });
  assert.deepEqual(canonicalizeInventoryDetailQuantityText("12\r3"), { status: "invalid" });
  assert.deepEqual(canonicalizeInventoryDetailQuantityText("12\x013"), { status: "invalid" });
  assert.deepEqual(canonicalizeInventoryDetailQuantityText("12\x7f3"), { status: "invalid" });
  assert.deepEqual(prepareInventoryDetailQuantityText("12\n3"), { status: "invalid" });
  assert.deepEqual(prepareInventoryDetailQuantityText("12\x7f3"), { status: "invalid" });

  assert.deepEqual(prepareInventoryDetailQuantityText(null), { status: "invalid" });
  assert.deepEqual(prepareInventoryDetailQuantityText(undefined), { status: "invalid" });
  assert.deepEqual(prepareInventoryDetailQuantityText(12), { status: "invalid" });
});

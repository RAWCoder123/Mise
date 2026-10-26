import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimLogDeliveryQuantityText,
  canonicalizeLogDeliveryQuantityText,
  prepareLogDeliveryQuantityText
} from "../services/domain/logDeliveryQuantityIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/logDeliveryQuantityIdentity.ts", import.meta.url),
  "utf8"
);
const screenSource = readFileSync(new URL("../app/more/log-delivery.tsx", import.meta.url), "utf8");
const countSource = readFileSync(new URL("../app/inventory/count.tsx", import.meta.url), "utf8");
const ordersSource = readFileSync(new URL("../app/(tabs)/orders.tsx", import.meta.url), "utf8");
const inventoryDetailSource = readFileSync(
  new URL("../app/inventory/[id].tsx", import.meta.url),
  "utf8"
);
const formattersSource = readFileSync(new URL("../i18n/formatters.ts", import.meta.url), "utf8");

test("MISE-005RE pins Log Delivery quantity draft identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005RE/);
  assert.match(screenSource, /MISE-005RE/);

  assert.match(
    identitySource,
    /export function asciiTrimLogDeliveryQuantityText\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    screenSource,
    /from "\.\.\/\.\.\/services\/domain\/logDeliveryQuantityIdentity"/
  );
  assert.match(screenSource, /prepareLogDeliveryQuantityText\(/);
  assert.match(screenSource, /parseNumber\(prepared\.text\)/);
  assert.doesNotMatch(screenSource, /const quantity = parseNumber\(quantityText\);/);

  // Open #886 owns Log Delivery notes; leave note Unicode trim alone on this tip.
  assert.match(screenSource, /note: noteText\.trim\(\) \|\| undefined/);
  assert.doesNotMatch(screenSource, /canonicalizeInventoryOperationNote/);
  assert.doesNotMatch(screenSource, /inventoryOperationNoteIdentity/);

  // Leave inventory count draftCounts, Orders recommendation quantities, and
  // inventory detail operation quantities on their existing contracts.
  assert.match(countSource, /draftCounts\[line\.inventory_item_id\]\?\.trim\(\)/);
  assert.match(ordersSource, /quantities\[recommendation\.id\]\?\.trim\(\)/);
  assert.match(inventoryDetailSource, /parseNumber\(quantityText\)/);

  // Live inventing substrate remains in locale parse; this tip refuses to feed
  // Unicode-padded drafts into it from Log Delivery.
  assert.match(formattersSource, /const trimmed = input\.trim\(\);/);

  // Do not rewrite sibling tips through this module.
  assert.doesNotMatch(identitySource, /prepareOrdersRecommendationQuantityText/);
  assert.doesNotMatch(identitySource, /prepareInventoryCountQuantityText/);
  assert.doesNotMatch(identitySource, /canonicalizeInventoryOperationNote/);
  assert.doesNotMatch(identitySource, /from ["']\.\/ordersRecommendationQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/inventoryCountQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/inventoryOperationNoteIdentity["']/);
  assert.doesNotMatch(
    screenSource,
    /from "\.\.\/\.\.\/services\/domain\/ordersRecommendationQuantityIdentity"/
  );
  assert.doesNotMatch(
    screenSource,
    /from "\.\.\/\.\.\/services\/domain\/inventoryCountQuantityIdentity"/
  );
});

test("ASCII trim keeps ordinary Log Delivery quantity drafts stable", () => {
  assert.equal(asciiTrimLogDeliveryQuantityText("  12  "), "12");
  assert.deepEqual(canonicalizeLogDeliveryQuantityText("\t12\n"), {
    status: "ok",
    text: "12"
  });
  assert.deepEqual(prepareLogDeliveryQuantityText("  12  "), {
    status: "ok",
    text: "12"
  });
  assert.deepEqual(prepareLogDeliveryQuantityText("0"), { status: "ok", text: "0" });
  assert.deepEqual(prepareLogDeliveryQuantityText("12.5"), {
    status: "ok",
    text: "12.5"
  });
  assert.deepEqual(prepareLogDeliveryQuantityText("1,234.5"), {
    status: "ok",
    text: "1,234.5"
  });
  assert.deepEqual(prepareLogDeliveryQuantityText("1.234,5"), {
    status: "ok",
    text: "1.234,5"
  });

  // Prior emptiness contract: ASCII-only whitespace softs to empty.
  assert.deepEqual(prepareLogDeliveryQuantityText("   "), { status: "empty" });
  assert.deepEqual(prepareLogDeliveryQuantityText("\t\n"), { status: "empty" });
  assert.deepEqual(prepareLogDeliveryQuantityText(""), { status: "empty" });
});

test("NBSP and em-space padding cannot invent a clean Log Delivery quantity", () => {
  const amount = "12";
  const nbspAmount = `\u00a0${amount}\u00a0`;
  const emAmount = `\u2003${amount}\u2003`;

  // Live inventing proof on Unicode trim (what parseLocalizedNumber does, and
  // what Log Delivery previously fed unprepared).
  assert.equal(nbspAmount.trim(), amount);
  assert.equal(emAmount.trim(), amount);

  assert.deepEqual(canonicalizeLogDeliveryQuantityText(nbspAmount), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeLogDeliveryQuantityText(emAmount), {
    status: "invalid"
  });
  assert.deepEqual(prepareLogDeliveryQuantityText(nbspAmount), { status: "invalid" });
  assert.deepEqual(prepareLogDeliveryQuantityText(emAmount), { status: "invalid" });

  // Soft empty Unicode-only padding falls through like prior parse emptiness
  // (quantity error), and must not invent an ok draft from a padded amount.
  assert.deepEqual(prepareLogDeliveryQuantityText("\u2003\u2003"), { status: "empty" });
  assert.deepEqual(prepareLogDeliveryQuantityText("\u00a0\u00a0"), { status: "empty" });
  assert.notDeepEqual(prepareLogDeliveryQuantityText(emAmount), { status: "empty" });
  assert.notDeepEqual(prepareLogDeliveryQuantityText(emAmount), {
    status: "ok",
    text: amount
  });
});

test("ASCII controls and non-string quantity drafts fail closed without inventing", () => {
  assert.deepEqual(canonicalizeLogDeliveryQuantityText("12\n3"), { status: "invalid" });
  assert.deepEqual(canonicalizeLogDeliveryQuantityText("12\r3"), { status: "invalid" });
  assert.deepEqual(canonicalizeLogDeliveryQuantityText("12\x013"), { status: "invalid" });
  assert.deepEqual(canonicalizeLogDeliveryQuantityText("12\x7f3"), { status: "invalid" });
  assert.deepEqual(prepareLogDeliveryQuantityText("12\n3"), { status: "invalid" });
  assert.deepEqual(prepareLogDeliveryQuantityText("12\x7f3"), { status: "invalid" });

  assert.deepEqual(prepareLogDeliveryQuantityText(null), { status: "invalid" });
  assert.deepEqual(prepareLogDeliveryQuantityText(undefined), { status: "invalid" });
  assert.deepEqual(prepareLogDeliveryQuantityText(12), { status: "invalid" });
});

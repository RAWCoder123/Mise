import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInventoryCountQuantityText,
  canonicalizeInventoryCountQuantityText,
  prepareInventoryCountQuantityText
} from "../services/domain/inventoryCountQuantityIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/inventoryCountQuantityIdentity.ts", import.meta.url),
  "utf8"
);
const countSource = readFileSync(new URL("../app/inventory/count.tsx", import.meta.url), "utf8");
const logDeliverySource = readFileSync(
  new URL("../app/more/log-delivery.tsx", import.meta.url),
  "utf8"
);
const ordersSource = readFileSync(new URL("../app/(tabs)/orders.tsx", import.meta.url), "utf8");

test("MISE-005RD pins inventory count quantity draft identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005RD/);
  assert.match(countSource, /MISE-005RD/);

  assert.match(
    identitySource,
    /export function asciiTrimInventoryCountQuantityText\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    countSource,
    /from "\.\.\/\.\.\/services\/domain\/inventoryCountQuantityIdentity"/
  );
  assert.match(countSource, /prepareInventoryCountQuantityText\(/);
  assert.match(countSource, /prepared\.quantity/);
  assert.doesNotMatch(countSource, /draftCounts\[line\.inventory_item_id\]\?\.trim\(\)/);
  assert.doesNotMatch(countSource, /Number\(raw\)/);

  const payloadBody = countSource.slice(
    countSource.indexOf("function buildCountLinePayload("),
    countSource.indexOf("async function saveProgress()")
  );
  assert.match(payloadBody, /prepareInventoryCountQuantityText\(/);
  assert.match(payloadBody, /prepared\.status !== "ok"/);
  // Open #885 owns count-sheet notes; leave note Unicode trim alone on this tip.
  assert.match(payloadBody, /noteRaw\.trim\(\)\.length > 240/);
  assert.match(payloadBody, /note: noteRaw\.trim\(\) \|\| null/);
  assert.doesNotMatch(payloadBody, /normalizeInventoryCountSheetNote/);

  // Presentation variance path uses the same prepare helper.
  assert.match(countSource, /preparedCount\.status === "ok" \? preparedCount\.quantity : null/);
  assert.match(countSource, /noteRaw\.trim\(\)\.length > 0/);

  // Leave Log Delivery quantity and Orders recommendation quantities alone.
  assert.match(logDeliverySource, /const quantity = parseNumber\(quantityText\);/);
  assert.match(ordersSource, /quantities\[recommendation\.id\]\?\.trim\(\)/);

  // Do not rewrite sibling tips through this module.
  assert.doesNotMatch(identitySource, /prepareOrdersRecommendationQuantityText/);
  assert.doesNotMatch(identitySource, /parseAutonomySpendLimitText/);
  assert.doesNotMatch(identitySource, /normalizeInventoryCountSheetNote/);
  assert.doesNotMatch(identitySource, /from ["']\.\/ordersRecommendationQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/inventoryCountSheetNoteIdentity["']/);
  assert.doesNotMatch(
    countSource,
    /from "\.\.\/\.\.\/services\/domain\/ordersRecommendationQuantityIdentity"/
  );
});

test("ASCII trim keeps ordinary inventory count quantity drafts stable", () => {
  assert.equal(asciiTrimInventoryCountQuantityText("  12  "), "12");
  assert.deepEqual(canonicalizeInventoryCountQuantityText("\t12\n"), {
    status: "ok",
    quantity: 12,
    text: "12"
  });
  assert.deepEqual(prepareInventoryCountQuantityText("  12  "), {
    status: "ok",
    quantity: 12,
    text: "12"
  });
  assert.deepEqual(prepareInventoryCountQuantityText("0"), {
    status: "ok",
    quantity: 0,
    text: "0"
  });
  assert.deepEqual(prepareInventoryCountQuantityText("12.5"), {
    status: "ok",
    quantity: 12.5,
    text: "12.5"
  });
  assert.deepEqual(prepareInventoryCountQuantityText("-1"), {
    status: "ok",
    quantity: -1,
    text: "-1"
  });

  // Prior emptiness contract: ASCII-only whitespace softs to empty.
  assert.deepEqual(prepareInventoryCountQuantityText("   "), { status: "empty" });
  assert.deepEqual(prepareInventoryCountQuantityText("\t\n"), { status: "empty" });
  assert.deepEqual(prepareInventoryCountQuantityText(""), { status: "empty" });
});

test("NBSP and em-space padding cannot invent a clean inventory count quantity", () => {
  const amount = "12";
  const nbspAmount = `\u00a0${amount}\u00a0`;
  const emAmount = `\u2003${amount}\u2003`;

  // Live inventing proof on Unicode trim / Number TrimString (what count.tsx used).
  assert.equal(nbspAmount.trim(), amount);
  assert.equal(emAmount.trim(), amount);
  assert.equal(Number(emAmount), 12);
  assert.equal(Number(nbspAmount), 12);

  assert.deepEqual(canonicalizeInventoryCountQuantityText(nbspAmount), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeInventoryCountQuantityText(emAmount), {
    status: "invalid"
  });
  assert.deepEqual(prepareInventoryCountQuantityText(nbspAmount), { status: "invalid" });
  assert.deepEqual(prepareInventoryCountQuantityText(emAmount), { status: "invalid" });

  // Soft empty Unicode-only padding falls through like prior `.trim()` emptiness
  // (skip line), and must not invent an ok quantity from a padded amount.
  assert.deepEqual(prepareInventoryCountQuantityText("\u2003\u2003"), { status: "empty" });
  assert.deepEqual(prepareInventoryCountQuantityText("\u00a0\u00a0"), { status: "empty" });
  assert.notDeepEqual(prepareInventoryCountQuantityText(emAmount), { status: "empty" });
  assert.notDeepEqual(prepareInventoryCountQuantityText(emAmount), {
    status: "ok",
    quantity: 12,
    text: amount
  });
});

test("ASCII controls and non-string quantity drafts fail closed without inventing", () => {
  assert.deepEqual(canonicalizeInventoryCountQuantityText("12\n3"), { status: "invalid" });
  assert.deepEqual(canonicalizeInventoryCountQuantityText("12\r3"), { status: "invalid" });
  assert.deepEqual(canonicalizeInventoryCountQuantityText("12\x013"), { status: "invalid" });
  assert.deepEqual(canonicalizeInventoryCountQuantityText("12\x7f3"), { status: "invalid" });
  assert.deepEqual(prepareInventoryCountQuantityText("12\n3"), { status: "invalid" });
  assert.deepEqual(prepareInventoryCountQuantityText("12\x7f3"), { status: "invalid" });
  assert.deepEqual(prepareInventoryCountQuantityText("abc"), { status: "invalid" });

  assert.deepEqual(prepareInventoryCountQuantityText(null), { status: "invalid" });
  assert.deepEqual(prepareInventoryCountQuantityText(undefined), { status: "invalid" });
  assert.deepEqual(prepareInventoryCountQuantityText(12), { status: "invalid" });
});

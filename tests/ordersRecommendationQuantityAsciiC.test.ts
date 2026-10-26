import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimOrdersRecommendationQuantityText,
  canonicalizeOrdersRecommendationQuantityText,
  prepareOrdersRecommendationQuantityText
} from "../services/domain/ordersRecommendationQuantityIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/ordersRecommendationQuantityIdentity.ts", import.meta.url),
  "utf8"
);
const screenSource = readFileSync(new URL("../app/(tabs)/orders.tsx", import.meta.url), "utf8");
const countSource = readFileSync(new URL("../app/inventory/count.tsx", import.meta.url), "utf8");
const logDeliverySource = readFileSync(
  new URL("../app/more/log-delivery.tsx", import.meta.url),
  "utf8"
);
const ordersUiSource = readFileSync(new URL("../tests/ordersUi.test.ts", import.meta.url), "utf8");

test("MISE-005RC pins Orders recommendation quantity draft identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005RC/);
  assert.match(screenSource, /MISE-005RC/);

  assert.match(
    identitySource,
    /export function asciiTrimOrdersRecommendationQuantityText\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    screenSource,
    /from "\.\.\/\.\.\/services\/domain\/ordersRecommendationQuantityIdentity"/
  );
  assert.match(screenSource, /prepareOrdersRecommendationQuantityText\(/);
  assert.match(screenSource, /parseNumber\(prepared\.text\)/);
  assert.doesNotMatch(screenSource, /quantities\[recommendation\.id\]\?\.trim\(\)/);
  assert.doesNotMatch(screenSource, /parseNumber\(rawQuantity\)/);

  // ordersUi contract stays aligned with the prepared-text parse path.
  assert.match(ordersUiSource, /prepareOrdersRecommendationQuantityText/);
  assert.match(ordersUiSource, /prepared\\.text/);
  assert.doesNotMatch(ordersUiSource, /parseNumber\\(rawQuantity\\)/);

  // Leave inventory count draftCounts and Log Delivery quantity on their
  // existing contracts (out of scope for this tip).
  assert.match(countSource, /draftCounts\[line\.inventory_item_id\]\?\.trim\(\)/);
  assert.match(logDeliverySource, /const quantity = parseNumber\(quantityText\);/);

  // Do not rewrite sibling tips through this module.
  assert.doesNotMatch(identitySource, /parseAutonomySpendLimitText/);
  assert.doesNotMatch(identitySource, /normalizeOrderPresentationLineLabel/);
  assert.doesNotMatch(identitySource, /from ["']\.\/autonomySpendLimitIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/orderPresentationLineIdentity["']/);
  assert.doesNotMatch(
    screenSource,
    /from "\.\.\/\.\.\/services\/domain\/autonomySpendLimitIdentity"/
  );
});

test("ASCII trim keeps ordinary Orders recommendation quantity drafts stable", () => {
  assert.equal(asciiTrimOrdersRecommendationQuantityText("  12  "), "12");
  assert.deepEqual(canonicalizeOrdersRecommendationQuantityText("\t12\n"), {
    status: "ok",
    text: "12"
  });
  assert.deepEqual(prepareOrdersRecommendationQuantityText("  12  "), {
    status: "ok",
    text: "12"
  });
  assert.deepEqual(prepareOrdersRecommendationQuantityText("0"), { status: "ok", text: "0" });
  assert.deepEqual(prepareOrdersRecommendationQuantityText("1,234.5"), {
    status: "ok",
    text: "1,234.5"
  });
  assert.deepEqual(prepareOrdersRecommendationQuantityText("1.234,5"), {
    status: "ok",
    text: "1.234,5"
  });

  // Prior emptiness contract: ASCII-only whitespace softs to empty.
  assert.deepEqual(prepareOrdersRecommendationQuantityText("   "), { status: "empty" });
  assert.deepEqual(prepareOrdersRecommendationQuantityText("\t\n"), { status: "empty" });
  assert.deepEqual(prepareOrdersRecommendationQuantityText(""), { status: "empty" });
});

test("NBSP and em-space padding cannot invent a clean Orders recommendation quantity", () => {
  const amount = "12";
  const nbspAmount = `\u00a0${amount}\u00a0`;
  const emAmount = `\u2003${amount}\u2003`;

  // Live inventing proof on Unicode trim (what orders.tsx used before this tip).
  assert.equal(nbspAmount.trim(), amount);
  assert.equal(emAmount.trim(), amount);

  assert.deepEqual(canonicalizeOrdersRecommendationQuantityText(nbspAmount), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeOrdersRecommendationQuantityText(emAmount), {
    status: "invalid"
  });
  assert.deepEqual(prepareOrdersRecommendationQuantityText(nbspAmount), { status: "invalid" });
  assert.deepEqual(prepareOrdersRecommendationQuantityText(emAmount), { status: "invalid" });

  // Soft empty Unicode-only padding falls through like prior `.trim()` emptiness
  // (quantity-range error), and must not invent an ok draft from a padded amount.
  assert.deepEqual(prepareOrdersRecommendationQuantityText("\u2003\u2003"), { status: "empty" });
  assert.deepEqual(prepareOrdersRecommendationQuantityText("\u00a0\u00a0"), { status: "empty" });
  assert.notDeepEqual(prepareOrdersRecommendationQuantityText(emAmount), { status: "empty" });
  assert.notDeepEqual(prepareOrdersRecommendationQuantityText(emAmount), {
    status: "ok",
    text: amount
  });
});

test("ASCII controls and non-string quantity drafts fail closed without inventing", () => {
  assert.deepEqual(canonicalizeOrdersRecommendationQuantityText("12\n3"), { status: "invalid" });
  assert.deepEqual(canonicalizeOrdersRecommendationQuantityText("12\r3"), { status: "invalid" });
  assert.deepEqual(canonicalizeOrdersRecommendationQuantityText("12\x013"), { status: "invalid" });
  assert.deepEqual(canonicalizeOrdersRecommendationQuantityText("12\x7f3"), { status: "invalid" });
  assert.deepEqual(prepareOrdersRecommendationQuantityText("12\n3"), { status: "invalid" });
  assert.deepEqual(prepareOrdersRecommendationQuantityText("12\x7f3"), { status: "invalid" });

  assert.deepEqual(prepareOrdersRecommendationQuantityText(null), { status: "invalid" });
  assert.deepEqual(prepareOrdersRecommendationQuantityText(undefined), { status: "invalid" });
  assert.deepEqual(prepareOrdersRecommendationQuantityText(12), { status: "invalid" });
});

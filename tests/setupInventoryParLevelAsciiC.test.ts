import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSetupInventoryParLevelText,
  canonicalizeSetupInventoryParLevelText,
  prepareSetupInventoryParLevelText
} from "../services/domain/setupInventoryParLevelIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/setupInventoryParLevelIdentity.ts", import.meta.url),
  "utf8"
);
const setupSource = readFileSync(new URL("../app/(auth)/setup.tsx", import.meta.url), "utf8");
const inventoryDetailSource = readFileSync(
  new URL("../app/inventory/[id].tsx", import.meta.url),
  "utf8"
);
const countSource = readFileSync(new URL("../app/inventory/count.tsx", import.meta.url), "utf8");
const ordersSource = readFileSync(new URL("../app/(tabs)/orders.tsx", import.meta.url), "utf8");
const logDeliverySource = readFileSync(
  new URL("../app/more/log-delivery.tsx", import.meta.url),
  "utf8"
);
const formattersSource = readFileSync(new URL("../i18n/formatters.ts", import.meta.url), "utf8");

test("MISE-005RH pins setup inventory parLevel draft identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005RH/);
  assert.match(setupSource, /MISE-005RH/);

  assert.match(
    identitySource,
    /export function asciiTrimSetupInventoryParLevelText\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    setupSource,
    /from "\.\.\/\.\.\/services\/domain\/setupInventoryParLevelIdentity"/
  );
  assert.match(setupSource, /prepareSetupInventoryParLevelText\(/);
  assert.match(setupSource, /normalizeSetupInventoryParLevel\(/);
  assert.match(
    setupSource,
    /isBoundedSetupNumber\(preparedParLevel\.text, 0, operatingLimits\.inventoryQuantity, parseNumber\)/
  );
  assert.doesNotMatch(
    setupSource,
    /if \(item\.parLevel\.trim\(\) && !isBoundedSetupNumber\(item\.parLevel,/
  );
  assert.doesNotMatch(
    setupSource,
    /parLevel: normalizeDraftNumber\(item\.parLevel, parseNumber\)/
  );

  // Leave setup inventory on-hand quantity on the prior bare contract.
  assert.match(
    setupSource,
    /if \(!isBoundedSetupNumber\(item\.quantity, 0, operatingLimits\.inventoryQuantity, parseNumber\)\)/
  );
  assert.match(setupSource, /quantity: normalizeDraftNumber\(item\.quantity, parseNumber\)/);

  // Leave recipe ingredient quantities alone.
  assert.match(
    setupSource,
    /isBoundedSetupNumber\(ingredient\.quantity, Number\.EPSILON, operatingLimits\.recipeQuantityPerSale, parseNumber\)/
  );
  assert.match(
    setupSource,
    /quantity: normalizeDraftNumber\(ingredient\.quantity, parseNumber\)/
  );

  // Open #893 owns inventory detail settings quantities; leave that path alone.
  assert.match(
    inventoryDetailSource,
    /par_level: parseNumber\(parLevel\) \?\? 0,/
  );
  assert.match(
    inventoryDetailSource,
    /reorder_threshold: parseNumber\(reorderThreshold\) \?\? 0/
  );
  assert.doesNotMatch(inventoryDetailSource, /prepareInventoryDetailSettingsQuantityText\(/);
  assert.doesNotMatch(inventoryDetailSource, /inventoryDetailSettingsQuantityIdentity/);

  // Open #892 owns inventory detail operation quantityText; leave that path alone.
  assert.match(
    inventoryDetailSource,
    /const quantity = operation === "stockout" \? 0 : parseNumber\(quantityText\);/
  );
  assert.doesNotMatch(inventoryDetailSource, /prepareInventoryDetailQuantityText\(/);
  assert.doesNotMatch(inventoryDetailSource, /inventoryDetailQuantityIdentity/);

  // Leave inventory count draftCounts, Orders recommendation quantities, and
  // Log Delivery quantities on their existing contracts.
  assert.match(countSource, /draftCounts\[line\.inventory_item_id\]\?\.trim\(\)/);
  assert.match(ordersSource, /quantities\[recommendation\.id\]\?\.trim\(\)/);
  assert.match(logDeliverySource, /parseNumber\(quantityText\)/);

  // Live inventing substrate remains in locale parse; this tip refuses to feed
  // Unicode-padded drafts into it from setup inventory parLevel.
  assert.match(formattersSource, /const trimmed = input\.trim\(\);/);

  // Do not rewrite sibling tips through this module.
  assert.doesNotMatch(identitySource, /prepareInventoryDetailSettingsQuantityText/);
  assert.doesNotMatch(identitySource, /prepareInventoryDetailQuantityText/);
  assert.doesNotMatch(identitySource, /prepareLogDeliveryQuantityText/);
  assert.doesNotMatch(identitySource, /prepareOrdersRecommendationQuantityText/);
  assert.doesNotMatch(identitySource, /prepareInventoryCountQuantityText/);
  assert.doesNotMatch(identitySource, /from ["']\.\/inventoryDetailSettingsQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/inventoryDetailQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/logDeliveryQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/ordersRecommendationQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/inventoryCountQuantityIdentity["']/);
  assert.doesNotMatch(
    setupSource,
    /from "\.\.\/\.\.\/services\/domain\/inventoryDetailSettingsQuantityIdentity"/
  );
  assert.doesNotMatch(
    setupSource,
    /from "\.\.\/\.\.\/services\/domain\/inventoryDetailQuantityIdentity"/
  );
  assert.doesNotMatch(
    setupSource,
    /from "\.\.\/\.\.\/services\/domain\/logDeliveryQuantityIdentity"/
  );
  assert.doesNotMatch(
    setupSource,
    /from "\.\.\/\.\.\/services\/domain\/inventoryCountQuantityIdentity"/
  );
  assert.doesNotMatch(
    setupSource,
    /from "\.\.\/\.\.\/services\/domain\/ordersRecommendationQuantityIdentity"/
  );
});

test("ASCII trim keeps ordinary setup inventory parLevel drafts stable", () => {
  assert.equal(asciiTrimSetupInventoryParLevelText("  12  "), "12");
  assert.deepEqual(canonicalizeSetupInventoryParLevelText("\t12\n"), {
    status: "ok",
    text: "12"
  });
  assert.deepEqual(prepareSetupInventoryParLevelText("  12  "), {
    status: "ok",
    text: "12"
  });
  assert.deepEqual(prepareSetupInventoryParLevelText("0"), { status: "ok", text: "0" });
  assert.deepEqual(prepareSetupInventoryParLevelText("12.5"), {
    status: "ok",
    text: "12.5"
  });
  assert.deepEqual(prepareSetupInventoryParLevelText("1,234.5"), {
    status: "ok",
    text: "1,234.5"
  });
  assert.deepEqual(prepareSetupInventoryParLevelText("1.234,5"), {
    status: "ok",
    text: "1.234,5"
  });

  // Prior emptiness contract: ASCII-only whitespace softs to empty (optional par).
  assert.deepEqual(prepareSetupInventoryParLevelText("   "), { status: "empty" });
  assert.deepEqual(prepareSetupInventoryParLevelText("\t\n"), { status: "empty" });
  assert.deepEqual(prepareSetupInventoryParLevelText(""), { status: "empty" });
});

test("NBSP and em-space padding cannot invent a clean setup inventory parLevel", () => {
  const amount = "12";
  const nbspAmount = `\u00a0${amount}\u00a0`;
  const emAmount = `\u2003${amount}\u2003`;

  // Live inventing proof on Unicode trim (what parseLocalizedNumber,
  // item.parLevel.trim(), and normalizeDraftNumber do, and what setup
  // inventory parLevel previously fed unprepared).
  assert.equal(nbspAmount.trim(), amount);
  assert.equal(emAmount.trim(), amount);
  assert.equal("\u2003".trim(), "");

  assert.deepEqual(canonicalizeSetupInventoryParLevelText(nbspAmount), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeSetupInventoryParLevelText(emAmount), {
    status: "invalid"
  });
  assert.deepEqual(prepareSetupInventoryParLevelText(nbspAmount), {
    status: "invalid"
  });
  assert.deepEqual(prepareSetupInventoryParLevelText(emAmount), {
    status: "invalid"
  });

  // Soft empty Unicode-only padding falls through like prior optional emptiness,
  // and must not invent an ok draft from a padded amount.
  assert.deepEqual(prepareSetupInventoryParLevelText("\u2003\u2003"), {
    status: "empty"
  });
  assert.deepEqual(prepareSetupInventoryParLevelText("\u00a0\u00a0"), {
    status: "empty"
  });
  assert.notDeepEqual(prepareSetupInventoryParLevelText(emAmount), {
    status: "empty"
  });
  assert.notDeepEqual(prepareSetupInventoryParLevelText(emAmount), {
    status: "ok",
    text: amount
  });
});

test("ASCII controls and non-string setup inventory parLevel drafts fail closed without inventing", () => {
  assert.deepEqual(canonicalizeSetupInventoryParLevelText("12\n3"), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeSetupInventoryParLevelText("12\r3"), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeSetupInventoryParLevelText("12\x013"), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeSetupInventoryParLevelText("12\x7f3"), {
    status: "invalid"
  });
  assert.deepEqual(prepareSetupInventoryParLevelText("12\n3"), { status: "invalid" });
  assert.deepEqual(prepareSetupInventoryParLevelText("12\x7f3"), {
    status: "invalid"
  });

  assert.deepEqual(prepareSetupInventoryParLevelText(null), { status: "invalid" });
  assert.deepEqual(prepareSetupInventoryParLevelText(undefined), {
    status: "invalid"
  });
  assert.deepEqual(prepareSetupInventoryParLevelText(12), { status: "invalid" });
});

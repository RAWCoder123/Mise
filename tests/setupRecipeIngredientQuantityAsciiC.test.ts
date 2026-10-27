import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSetupRecipeIngredientQuantityText,
  canonicalizeSetupRecipeIngredientQuantityText,
  prepareSetupRecipeIngredientQuantityText
} from "../services/domain/setupRecipeIngredientQuantityIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/setupRecipeIngredientQuantityIdentity.ts", import.meta.url),
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

test("MISE-005RJ pins setup recipe ingredient quantity draft identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005RJ/);
  assert.match(setupSource, /MISE-005RJ/);

  assert.match(
    identitySource,
    /export function asciiTrimSetupRecipeIngredientQuantityText\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    setupSource,
    /from "\.\.\/\.\.\/services\/domain\/setupRecipeIngredientQuantityIdentity"/
  );
  assert.match(setupSource, /prepareSetupRecipeIngredientQuantityText\(/);
  assert.match(setupSource, /normalizeSetupRecipeIngredientQuantity\(/);
  assert.match(
    setupSource,
    /isBoundedSetupNumber\(\s*preparedQuantity\.text,\s*Number\.EPSILON,\s*operatingLimits\.recipeQuantityPerSale,\s*parseNumber\s*\)/
  );
  assert.doesNotMatch(
    setupSource,
    /if \(!ingredient\.itemName\.trim\(\) \|\| !ingredient\.quantity\.trim\(\) \|\| !ingredient\.unit\.trim\(\)\)/
  );
  assert.doesNotMatch(
    setupSource,
    /isBoundedSetupNumber\(ingredient\.quantity, Number\.EPSILON, operatingLimits\.recipeQuantityPerSale, parseNumber\)/
  );
  assert.doesNotMatch(
    setupSource,
    /quantity: normalizeDraftNumber\(ingredient\.quantity, parseNumber\)/
  );

  // Leave setup inventory on-hand quantity on the prior bare contract (open #895).
  assert.match(
    setupSource,
    /if \(!item\.quantity\.trim\(\)\) return setupValidationFailure\("inventory", t\("setup\.validation\.needsQuantity"/
  );
  assert.match(
    setupSource,
    /if \(!isBoundedSetupNumber\(item\.quantity, 0, operatingLimits\.inventoryQuantity, parseNumber\)\)/
  );
  assert.match(setupSource, /quantity: normalizeDraftNumber\(item\.quantity, parseNumber\)/);
  assert.doesNotMatch(setupSource, /prepareSetupInventoryQuantityText\(/);
  assert.doesNotMatch(setupSource, /setupInventoryQuantityIdentity/);

  // Leave setup inventory parLevel on the prior bare contract (open #894).
  assert.match(
    setupSource,
    /if \(item\.parLevel\.trim\(\) && !isBoundedSetupNumber\(item\.parLevel,/
  );
  assert.match(setupSource, /parLevel: normalizeDraftNumber\(item\.parLevel, parseNumber\)/);
  assert.doesNotMatch(setupSource, /prepareSetupInventoryParLevelText\(/);
  assert.doesNotMatch(setupSource, /setupInventoryParLevelIdentity/);

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
  // Unicode-padded drafts into it from setup recipe ingredient quantity.
  assert.match(formattersSource, /const trimmed = input\.trim\(\);/);

  // Do not rewrite sibling tips through this module.
  assert.doesNotMatch(identitySource, /prepareSetupInventoryQuantityText/);
  assert.doesNotMatch(identitySource, /prepareSetupInventoryParLevelText/);
  assert.doesNotMatch(identitySource, /prepareInventoryDetailSettingsQuantityText/);
  assert.doesNotMatch(identitySource, /prepareInventoryDetailQuantityText/);
  assert.doesNotMatch(identitySource, /prepareLogDeliveryQuantityText/);
  assert.doesNotMatch(identitySource, /prepareOrdersRecommendationQuantityText/);
  assert.doesNotMatch(identitySource, /prepareInventoryCountQuantityText/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupInventoryQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupInventoryParLevelIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/inventoryDetailSettingsQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/inventoryDetailQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/logDeliveryQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/ordersRecommendationQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/inventoryCountQuantityIdentity["']/);
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

test("ASCII trim keeps ordinary setup recipe ingredient quantity drafts stable", () => {
  assert.equal(asciiTrimSetupRecipeIngredientQuantityText("  12  "), "12");
  assert.deepEqual(canonicalizeSetupRecipeIngredientQuantityText("\t12\n"), {
    status: "ok",
    text: "12"
  });
  assert.deepEqual(prepareSetupRecipeIngredientQuantityText("  12  "), {
    status: "ok",
    text: "12"
  });
  assert.deepEqual(prepareSetupRecipeIngredientQuantityText("0.5"), {
    status: "ok",
    text: "0.5"
  });
  assert.deepEqual(prepareSetupRecipeIngredientQuantityText("12.5"), {
    status: "ok",
    text: "12.5"
  });
  assert.deepEqual(prepareSetupRecipeIngredientQuantityText("1,234.5"), {
    status: "ok",
    text: "1,234.5"
  });
  assert.deepEqual(prepareSetupRecipeIngredientQuantityText("1.234,5"), {
    status: "ok",
    text: "1.234,5"
  });

  // Prior emptiness contract: ASCII-only whitespace softs to empty (required quantity).
  assert.deepEqual(prepareSetupRecipeIngredientQuantityText("   "), { status: "empty" });
  assert.deepEqual(prepareSetupRecipeIngredientQuantityText("\t\n"), { status: "empty" });
  assert.deepEqual(prepareSetupRecipeIngredientQuantityText(""), { status: "empty" });
});

test("NBSP and em-space padding cannot invent a clean setup recipe ingredient quantity", () => {
  const amount = "12";
  const nbspAmount = `\u00a0${amount}\u00a0`;
  const emAmount = `\u2003${amount}\u2003`;

  // Live inventing proof on Unicode trim (what parseLocalizedNumber,
  // ingredient.quantity.trim(), and normalizeDraftNumber do, and what setup
  // recipe ingredient quantity previously fed unprepared).
  assert.equal(nbspAmount.trim(), amount);
  assert.equal(emAmount.trim(), amount);
  assert.equal("\u2003".trim(), "");

  assert.deepEqual(canonicalizeSetupRecipeIngredientQuantityText(nbspAmount), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeSetupRecipeIngredientQuantityText(emAmount), {
    status: "invalid"
  });
  assert.deepEqual(prepareSetupRecipeIngredientQuantityText(nbspAmount), {
    status: "invalid"
  });
  assert.deepEqual(prepareSetupRecipeIngredientQuantityText(emAmount), {
    status: "invalid"
  });

  // Soft empty Unicode-only padding falls through like prior required emptiness,
  // and must not invent an ok draft from a padded amount.
  assert.deepEqual(prepareSetupRecipeIngredientQuantityText("\u2003\u2003"), {
    status: "empty"
  });
  assert.deepEqual(prepareSetupRecipeIngredientQuantityText("\u00a0\u00a0"), {
    status: "empty"
  });
  assert.notDeepEqual(prepareSetupRecipeIngredientQuantityText(emAmount), {
    status: "empty"
  });
  assert.notDeepEqual(prepareSetupRecipeIngredientQuantityText(emAmount), {
    status: "ok",
    text: amount
  });
});

test("ASCII controls and non-string setup recipe ingredient quantity drafts fail closed without inventing", () => {
  assert.deepEqual(canonicalizeSetupRecipeIngredientQuantityText("12\n3"), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeSetupRecipeIngredientQuantityText("12\r3"), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeSetupRecipeIngredientQuantityText("12\x013"), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeSetupRecipeIngredientQuantityText("12\x7f3"), {
    status: "invalid"
  });
  assert.deepEqual(prepareSetupRecipeIngredientQuantityText("12\n3"), { status: "invalid" });
  assert.deepEqual(prepareSetupRecipeIngredientQuantityText("12\x7f3"), {
    status: "invalid"
  });

  assert.deepEqual(prepareSetupRecipeIngredientQuantityText(null), { status: "invalid" });
  assert.deepEqual(prepareSetupRecipeIngredientQuantityText(undefined), {
    status: "invalid"
  });
  assert.deepEqual(prepareSetupRecipeIngredientQuantityText(12), { status: "invalid" });
});

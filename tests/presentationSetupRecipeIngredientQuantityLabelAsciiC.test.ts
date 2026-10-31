import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  asciiTrimPresentationSetupRecipeIngredientQuantityLabel,
  canonicalizePresentationSetupRecipeIngredientQuantityLabel,
  normalizePresentationSetupRecipeIngredientQuantityLabel,
  presentationSetupRecipeIngredientQuantityLabel
} from "../services/domain/presentationSetupRecipeIngredientQuantityLabelIdentity";

test("MISE-005UP pins setup recipe ingredient quantity-per-sale assertBounded error labels to ASCII C", () => {
  const identitySource = readFileSync(
    "services/domain/presentationSetupRecipeIngredientQuantityLabelIdentity.ts",
    "utf8"
  );
  const setupSource = readFileSync("services/application/setup.ts", "utf8");

  assert.match(identitySource, /MISE-005UP/);
  assert.match(setupSource, /MISE-005UP/);

  assert.match(
    identitySource,
    /export function asciiTrimPresentationSetupRecipeIngredientQuantityLabel\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    setupSource,
    /presentationSetupRecipeIngredientQuantityLabel\(ingredient\.itemName\) \|\|\s*"Recipe ingredient"/
  );
  assert.match(
    setupSource,
    /from "\.\.\/domain\/presentationSetupRecipeIngredientQuantityLabelIdentity"/
  );
  assert.match(setupSource, /\$\{quantityPerSaleLabel\} quantity per sale/);

  // Leave prior raw recipe ingredient label embedding removed from
  // validateSetupInput.
  assert.doesNotMatch(
    setupSource,
    /\$\{ingredient\.itemName \|\| "Recipe ingredient"\} quantity per sale/
  );

  // Do not share inventory quantity/par / ingredient validation / recipe
  // validation / durable recipe ingredient / setup-drafts / Recipes Settings
  // quantity modules.
  assert.doesNotMatch(
    identitySource,
    /presentationSetupInventoryQuantityParLabelIdentity|presentationSetupIngredientValidationLabelIdentity|presentationSetupRecipeValidationLabelIdentity|setupRecipeIngredientItemNameIdentity|setupDraftsRecipeIngredientItemNameIdentity|presentationRecipesSettingsQuantityIdentity/
  );
  assert.doesNotMatch(
    setupSource,
    /presentationSetupInventoryQuantityParLabelIdentity|presentationSetupIngredientValidationLabelIdentity|presentationSetupRecipeValidationLabelIdentity/
  );

  // Leave inventory quantity/par assertBounded inventing path alone
  // (open #979 / MISE-005UO owns quantity/par).
  assert.match(
    setupSource,
    /\$\{item\.name \|\| "Inventory item"\} quantity/
  );
  assert.match(
    setupSource,
    /\$\{item\.name \|\| "Inventory item"\} par level/
  );

  // Leave supplier-required inventing path alone (open #977 / MISE-005UM).
  assert.match(
    setupSource,
    /\$\{item\.name\.trim\(\) \|\| "Inventory item"\} requires a configured supplier/
  );

  // Leave durable save-path ingredient.itemName.trim() alone.
  assert.match(setupSource, /const ingredientName = ingredient\.itemName\.trim\(\);/);

  const ingredientName = "Roma Tomatoes";
  assert.equal(
    asciiTrimPresentationSetupRecipeIngredientQuantityLabel(`  ${ingredientName}  `),
    ingredientName
  );
  assert.equal(asciiTrimPresentationSetupRecipeIngredientQuantityLabel(`\tRoma\n`), "Roma");
  assert.equal(
    normalizePresentationSetupRecipeIngredientQuantityLabel(`  ${ingredientName}  `),
    ingredientName
  );
  assert.equal(
    canonicalizePresentationSetupRecipeIngredientQuantityLabel(`  ${ingredientName}  `),
    ingredientName
  );
  assert.equal(
    presentationSetupRecipeIngredientQuantityLabel(`  ${ingredientName}  `),
    ingredientName
  );

  // Soft empty / Unicode-only space preserves intentional English fallback.
  assert.equal(normalizePresentationSetupRecipeIngredientQuantityLabel(""), null);
  assert.equal(normalizePresentationSetupRecipeIngredientQuantityLabel("   "), null);
  assert.equal(normalizePresentationSetupRecipeIngredientQuantityLabel("\u2003"), null);
  assert.equal(normalizePresentationSetupRecipeIngredientQuantityLabel("\u00a0"), null);
  assert.equal(normalizePresentationSetupRecipeIngredientQuantityLabel(null), null);
  assert.equal(normalizePresentationSetupRecipeIngredientQuantityLabel(undefined), null);
  assert.equal(presentationSetupRecipeIngredientQuantityLabel(null), null);
  assert.equal(presentationSetupRecipeIngredientQuantityLabel("\u2003"), null);
});

test("MISE-005UP refuses Unicode-trim inventing of clean setup recipe ingredient quantity-per-sale error labels", () => {
  const paddedName = "\u2003Roma Tomatoes\u2003";
  const nbspName = "\u00a0Roma Tomatoes\u00a0";
  const unicodeOnlySpace = "\u2003";

  // Inventing proof: Unicode trim invents a clean ingredient identity.
  assert.equal(paddedName.trim(), "Roma Tomatoes");
  assert.equal(nbspName.trim(), "Roma Tomatoes");
  assert.equal(paddedName.trim() || "Recipe ingredient", "Roma Tomatoes");
  assert.equal(
    `${paddedName.trim() || "Recipe ingredient"} quantity per sale`,
    "Roma Tomatoes quantity per sale"
  );

  // Prior raw embedding: Unicode-only space is truthy and bypasses fallback.
  assert.equal(Boolean(unicodeOnlySpace), true);
  assert.equal(
    `${unicodeOnlySpace || "Recipe ingredient"} quantity per sale`,
    "\u2003 quantity per sale"
  );

  // ASCII C prep leaves Unicode end padding alone and soft-nulls.
  assert.equal(asciiTrimPresentationSetupRecipeIngredientQuantityLabel(paddedName), paddedName);
  assert.equal(asciiTrimPresentationSetupRecipeIngredientQuantityLabel(nbspName), nbspName);
  assert.equal(canonicalizePresentationSetupRecipeIngredientQuantityLabel(paddedName), null);
  assert.equal(canonicalizePresentationSetupRecipeIngredientQuantityLabel(nbspName), null);
  assert.equal(normalizePresentationSetupRecipeIngredientQuantityLabel(paddedName), null);
  assert.equal(normalizePresentationSetupRecipeIngredientQuantityLabel(nbspName), null);
  assert.equal(presentationSetupRecipeIngredientQuantityLabel(paddedName), null);
  assert.equal(presentationSetupRecipeIngredientQuantityLabel(nbspName), null);
  assert.equal(presentationSetupRecipeIngredientQuantityLabel(unicodeOnlySpace), null);

  // Soft-null preserves intentional English fallback for quantity-per-sale Errors.
  assert.equal(
    `${presentationSetupRecipeIngredientQuantityLabel(paddedName) || "Recipe ingredient"} quantity per sale`,
    "Recipe ingredient quantity per sale"
  );
  assert.equal(
    `${presentationSetupRecipeIngredientQuantityLabel(nbspName) || "Recipe ingredient"} quantity per sale`,
    "Recipe ingredient quantity per sale"
  );
  assert.equal(
    `${presentationSetupRecipeIngredientQuantityLabel(unicodeOnlySpace) || "Recipe ingredient"} quantity per sale`,
    "Recipe ingredient quantity per sale"
  );
});

test("MISE-005UP fails closed on control-bearing setup recipe ingredient quantity-per-sale error labels", () => {
  assert.equal(
    canonicalizePresentationSetupRecipeIngredientQuantityLabel("Roma\u0000Tomatoes"),
    null
  );
  assert.equal(
    normalizePresentationSetupRecipeIngredientQuantityLabel("Roma\u0007Tomatoes"),
    null
  );
  assert.equal(presentationSetupRecipeIngredientQuantityLabel("Roma\u001fTomatoes"), null);
  assert.equal(presentationSetupRecipeIngredientQuantityLabel(123 as unknown as string), null);
});

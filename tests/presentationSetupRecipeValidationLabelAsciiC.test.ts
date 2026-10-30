import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  asciiTrimPresentationSetupRecipeValidationLabel,
  canonicalizePresentationSetupRecipeValidationLabel,
  normalizePresentationSetupRecipeValidationLabel,
  presentationSetupRecipeValidationLabel
} from "../services/domain/presentationSetupRecipeValidationLabelIdentity";

test("MISE-005UK pins setup recipe validation labels to ASCII C", () => {
  const identitySource = readFileSync(
    "services/domain/presentationSetupRecipeValidationLabelIdentity.ts",
    "utf8"
  );
  const setupSource = readFileSync("app/(auth)/setup.tsx", "utf8");

  assert.match(
    identitySource,
    /export function asciiTrimPresentationSetupRecipeValidationLabel\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    setupSource,
    /presentationSetupRecipeValidationLabel\(recipe\.dishName\) \|\|\s*t\("setup\.validation\.recipeLabel"/
  );
  assert.match(
    setupSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationSetupRecipeValidationLabelIdentity"/
  );

  // Leave prior Unicode recipe validation label trim removed from setup validation.
  assert.doesNotMatch(
    setupSource,
    /const recipeLabel = recipe\.dishName\.trim\(\) \|\| t\("setup\.validation\.recipeLabel"/
  );

  // Do not share inventory validation / supplier chip / durable supplierNames /
  // Login / Create Task / supplier-draft-line modules.
  assert.doesNotMatch(
    setupSource,
    /presentationSetupInventoryValidationLabelIdentity|presentationSetupSupplierChipLabelIdentity|setupSupplierNamesIdentity|setupScreenSupplierIdentity|presentationLoginEmailChipLabelIdentity|presentationCreateTaskAssigneeLabelIdentity|presentationSupplierDraftLineIdentity/
  );

  // Leave ingredient validation label inventing alone.
  assert.match(
    setupSource,
    /const ingredientLabel = ingredient\.itemName\.trim\(\) \|\| t\("setup\.validation\.ingredientLabel"/
  );

  // Leave inventory validation label inventing alone on this tip (owned by #974).
  assert.match(
    setupSource,
    /item\.name\.trim\(\) \|\| t\("setup\.validation\.inventoryLabel"/
  );

  const dishName = "Margherita Pizza";
  assert.equal(
    asciiTrimPresentationSetupRecipeValidationLabel(`  ${dishName}  `),
    dishName
  );
  assert.equal(asciiTrimPresentationSetupRecipeValidationLabel(`\tPizza\n`), "Pizza");
  assert.equal(
    normalizePresentationSetupRecipeValidationLabel(`  ${dishName}  `),
    dishName
  );
  assert.equal(
    canonicalizePresentationSetupRecipeValidationLabel(`  ${dishName}  `),
    dishName
  );
  assert.equal(
    presentationSetupRecipeValidationLabel(`  ${dishName}  `),
    dishName
  );

  // Soft empty / Unicode-only space preserves intentional i18n recipeLabel fallback.
  assert.equal(normalizePresentationSetupRecipeValidationLabel(""), null);
  assert.equal(normalizePresentationSetupRecipeValidationLabel("   "), null);
  assert.equal(normalizePresentationSetupRecipeValidationLabel("\u2003"), null);
  assert.equal(normalizePresentationSetupRecipeValidationLabel("\u00a0"), null);
  assert.equal(normalizePresentationSetupRecipeValidationLabel(null), null);
  assert.equal(normalizePresentationSetupRecipeValidationLabel(undefined), null);
  assert.equal(presentationSetupRecipeValidationLabel(null), null);
  assert.equal(presentationSetupRecipeValidationLabel("\u2003"), null);
});

test("MISE-005UK refuses Unicode-trim inventing of clean setup recipe validation labels", () => {
  const paddedName = "\u2003Margherita Pizza\u2003";
  const nbspName = "\u00a0Margherita Pizza\u00a0";

  // Inventing proof on prior Unicode trim path.
  assert.equal(paddedName.trim(), "Margherita Pizza");
  assert.equal(nbspName.trim(), "Margherita Pizza");
  assert.equal(paddedName.trim() || "Recipe 1", "Margherita Pizza");
  assert.equal("".trim() || "Recipe 1", "Recipe 1");

  // ASCII C prep leaves Unicode end padding alone and soft-nulls.
  assert.equal(asciiTrimPresentationSetupRecipeValidationLabel(paddedName), paddedName);
  assert.equal(asciiTrimPresentationSetupRecipeValidationLabel(nbspName), nbspName);
  assert.equal(canonicalizePresentationSetupRecipeValidationLabel(paddedName), null);
  assert.equal(canonicalizePresentationSetupRecipeValidationLabel(nbspName), null);
  assert.equal(normalizePresentationSetupRecipeValidationLabel(paddedName), null);
  assert.equal(normalizePresentationSetupRecipeValidationLabel(nbspName), null);
  assert.equal(presentationSetupRecipeValidationLabel(paddedName), null);
  assert.equal(presentationSetupRecipeValidationLabel(nbspName), null);
});

test("MISE-005UK soft-nulls controls and preserves ordinary ASCII recipe names", () => {
  assert.equal(normalizePresentationSetupRecipeValidationLabel("Margherita\u0001Pizza"), null);
  assert.equal(normalizePresentationSetupRecipeValidationLabel("\u0007Carbonara"), null);

  assert.equal(presentationSetupRecipeValidationLabel("Carbonara"), "Carbonara");
  assert.equal(presentationSetupRecipeValidationLabel("  Caesar Salad  "), "Caesar Salad");
  assert.equal(presentationSetupRecipeValidationLabel("Crème Brûlée"), "Crème Brûlée");
});

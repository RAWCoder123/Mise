import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  asciiTrimPresentationSetupIngredientValidationLabel,
  canonicalizePresentationSetupIngredientValidationLabel,
  normalizePresentationSetupIngredientValidationLabel,
  presentationSetupIngredientValidationLabel
} from "../services/domain/presentationSetupIngredientValidationLabelIdentity";

test("MISE-005UL pins setup ingredient validation labels to ASCII C", () => {
  const identitySource = readFileSync(
    "services/domain/presentationSetupIngredientValidationLabelIdentity.ts",
    "utf8"
  );
  const setupSource = readFileSync("app/(auth)/setup.tsx", "utf8");

  assert.match(
    identitySource,
    /export function asciiTrimPresentationSetupIngredientValidationLabel\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    setupSource,
    /presentationSetupIngredientValidationLabel\(ingredient\.itemName\) \|\|\s*t\("setup\.validation\.ingredientLabel"/
  );
  assert.match(
    setupSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationSetupIngredientValidationLabelIdentity"/
  );

  // Leave prior Unicode ingredient validation label trim removed from setup validation.
  assert.doesNotMatch(
    setupSource,
    /const ingredientLabel = ingredient\.itemName\.trim\(\) \|\| t\("setup\.validation\.ingredientLabel"/
  );

  // Do not share recipe validation / inventory validation / supplier chip /
  // durable supplierNames / Login / Create Task / supplier-draft-line modules.
  assert.doesNotMatch(
    setupSource,
    /presentationSetupRecipeValidationLabelIdentity|presentationSetupInventoryValidationLabelIdentity|presentationSetupSupplierChipLabelIdentity|setupSupplierNamesIdentity|setupScreenSupplierIdentity|presentationLoginEmailChipLabelIdentity|presentationCreateTaskAssigneeLabelIdentity|presentationSupplierDraftLineIdentity/
  );

  // Leave recipe validation label inventing alone on this tip (owned by #975).
  assert.match(
    setupSource,
    /const recipeLabel = recipe\.dishName\.trim\(\) \|\| t\("setup\.validation\.recipeLabel"/
  );

  // Leave inventory validation label inventing alone on this tip (owned by #974).
  assert.match(
    setupSource,
    /item\.name\.trim\(\) \|\| t\("setup\.validation\.inventoryLabel"/
  );

  const itemName = "Roma Tomatoes";
  assert.equal(
    asciiTrimPresentationSetupIngredientValidationLabel(`  ${itemName}  `),
    itemName
  );
  assert.equal(asciiTrimPresentationSetupIngredientValidationLabel(`\tBasil\n`), "Basil");
  assert.equal(
    normalizePresentationSetupIngredientValidationLabel(`  ${itemName}  `),
    itemName
  );
  assert.equal(
    canonicalizePresentationSetupIngredientValidationLabel(`  ${itemName}  `),
    itemName
  );
  assert.equal(
    presentationSetupIngredientValidationLabel(`  ${itemName}  `),
    itemName
  );

  // Soft empty / Unicode-only space preserves intentional i18n ingredientLabel fallback.
  assert.equal(normalizePresentationSetupIngredientValidationLabel(""), null);
  assert.equal(normalizePresentationSetupIngredientValidationLabel("   "), null);
  assert.equal(normalizePresentationSetupIngredientValidationLabel("\u2003"), null);
  assert.equal(normalizePresentationSetupIngredientValidationLabel("\u00a0"), null);
  assert.equal(normalizePresentationSetupIngredientValidationLabel(null), null);
  assert.equal(normalizePresentationSetupIngredientValidationLabel(undefined), null);
  assert.equal(presentationSetupIngredientValidationLabel(null), null);
  assert.equal(presentationSetupIngredientValidationLabel("\u2003"), null);
});

test("MISE-005UL refuses Unicode-trim inventing of clean setup ingredient validation labels", () => {
  const paddedName = "\u2003Roma Tomatoes\u2003";
  const nbspName = "\u00a0Roma Tomatoes\u00a0";

  // Inventing proof on prior Unicode trim path.
  assert.equal(paddedName.trim(), "Roma Tomatoes");
  assert.equal(nbspName.trim(), "Roma Tomatoes");
  assert.equal(paddedName.trim() || "Ingredient 1", "Roma Tomatoes");
  assert.equal("".trim() || "Ingredient 1", "Ingredient 1");

  // ASCII C prep leaves Unicode end padding alone and soft-nulls.
  assert.equal(asciiTrimPresentationSetupIngredientValidationLabel(paddedName), paddedName);
  assert.equal(asciiTrimPresentationSetupIngredientValidationLabel(nbspName), nbspName);
  assert.equal(canonicalizePresentationSetupIngredientValidationLabel(paddedName), null);
  assert.equal(canonicalizePresentationSetupIngredientValidationLabel(nbspName), null);
  assert.equal(normalizePresentationSetupIngredientValidationLabel(paddedName), null);
  assert.equal(normalizePresentationSetupIngredientValidationLabel(nbspName), null);
  assert.equal(presentationSetupIngredientValidationLabel(paddedName), null);
  assert.equal(presentationSetupIngredientValidationLabel(nbspName), null);
});

test("MISE-005UL soft-nulls controls and preserves ordinary ASCII ingredient names", () => {
  assert.equal(normalizePresentationSetupIngredientValidationLabel("Roma\u0001Tomatoes"), null);
  assert.equal(normalizePresentationSetupIngredientValidationLabel("\u0007Basil"), null);

  assert.equal(presentationSetupIngredientValidationLabel("Basil"), "Basil");
  assert.equal(presentationSetupIngredientValidationLabel("  Extra Virgin Olive Oil  "), "Extra Virgin Olive Oil");
  assert.equal(presentationSetupIngredientValidationLabel("Crème fraîche"), "Crème fraîche");
});

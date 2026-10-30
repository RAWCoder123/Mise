import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  asciiTrimPresentationSetupInventoryValidationLabel,
  canonicalizePresentationSetupInventoryValidationLabel,
  normalizePresentationSetupInventoryValidationLabel,
  presentationSetupInventoryValidationLabel
} from "../services/domain/presentationSetupInventoryValidationLabelIdentity";

test("MISE-005UJ pins setup inventory validation labels to ASCII C", () => {
  const identitySource = readFileSync(
    "services/domain/presentationSetupInventoryValidationLabelIdentity.ts",
    "utf8"
  );
  const setupSource = readFileSync("app/(auth)/setup.tsx", "utf8");

  assert.match(
    identitySource,
    /export function asciiTrimPresentationSetupInventoryValidationLabel\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    setupSource,
    /presentationSetupInventoryValidationLabel\(item\.name\) \|\|\s*t\("setup\.validation\.inventoryLabel"/
  );
  assert.match(
    setupSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationSetupInventoryValidationLabelIdentity"/
  );

  // Leave prior Unicode inventory validation label trim removed from setup validation.
  assert.doesNotMatch(
    setupSource,
    /const label = item\.name\.trim\(\) \|\| t\("setup\.validation\.inventoryLabel"/
  );

  // Do not share supplier chip / durable supplierNames / Login / Create Task /
  // supplier-draft-line modules.
  assert.doesNotMatch(
    setupSource,
    /presentationSetupSupplierChipLabelIdentity|setupSupplierNamesIdentity|setupScreenSupplierIdentity|presentationLoginEmailChipLabelIdentity|presentationCreateTaskAssigneeLabelIdentity|presentationSupplierDraftLineIdentity/
  );

  // Leave recipe / ingredient validation label inventing alone.
  assert.match(
    setupSource,
    /const recipeLabel = recipe\.dishName\.trim\(\) \|\| t\("setup\.validation\.recipeLabel"/
  );
  assert.match(
    setupSource,
    /const ingredientLabel = ingredient\.itemName\.trim\(\) \|\| t\("setup\.validation\.ingredientLabel"/
  );

  const inventoryName = "Roma Tomatoes";
  assert.equal(
    asciiTrimPresentationSetupInventoryValidationLabel(`  ${inventoryName}  `),
    inventoryName
  );
  assert.equal(asciiTrimPresentationSetupInventoryValidationLabel(`\tRoma\n`), "Roma");
  assert.equal(
    normalizePresentationSetupInventoryValidationLabel(`  ${inventoryName}  `),
    inventoryName
  );
  assert.equal(
    canonicalizePresentationSetupInventoryValidationLabel(`  ${inventoryName}  `),
    inventoryName
  );
  assert.equal(
    presentationSetupInventoryValidationLabel(`  ${inventoryName}  `),
    inventoryName
  );

  // Soft empty / Unicode-only space preserves intentional i18n inventoryLabel fallback.
  assert.equal(normalizePresentationSetupInventoryValidationLabel(""), null);
  assert.equal(normalizePresentationSetupInventoryValidationLabel("   "), null);
  assert.equal(normalizePresentationSetupInventoryValidationLabel("\u2003"), null);
  assert.equal(normalizePresentationSetupInventoryValidationLabel("\u00a0"), null);
  assert.equal(normalizePresentationSetupInventoryValidationLabel(null), null);
  assert.equal(normalizePresentationSetupInventoryValidationLabel(undefined), null);
  assert.equal(presentationSetupInventoryValidationLabel(null), null);
  assert.equal(presentationSetupInventoryValidationLabel("\u2003"), null);
});

test("MISE-005UJ refuses Unicode-trim inventing of clean setup inventory validation labels", () => {
  const paddedName = "\u2003Roma Tomatoes\u2003";
  const nbspName = "\u00a0Roma Tomatoes\u00a0";

  // Inventing proof on prior Unicode trim path.
  assert.equal(paddedName.trim(), "Roma Tomatoes");
  assert.equal(nbspName.trim(), "Roma Tomatoes");
  assert.equal(paddedName.trim() || "Item 1", "Roma Tomatoes");
  assert.equal("".trim() || "Item 1", "Item 1");

  // ASCII C prep leaves Unicode end padding alone and soft-nulls.
  assert.equal(asciiTrimPresentationSetupInventoryValidationLabel(paddedName), paddedName);
  assert.equal(asciiTrimPresentationSetupInventoryValidationLabel(nbspName), nbspName);
  assert.equal(canonicalizePresentationSetupInventoryValidationLabel(paddedName), null);
  assert.equal(canonicalizePresentationSetupInventoryValidationLabel(nbspName), null);
  assert.equal(normalizePresentationSetupInventoryValidationLabel(paddedName), null);
  assert.equal(normalizePresentationSetupInventoryValidationLabel(nbspName), null);
  assert.equal(presentationSetupInventoryValidationLabel(paddedName), null);
  assert.equal(presentationSetupInventoryValidationLabel(nbspName), null);
});

test("MISE-005UJ soft-nulls controls and preserves ordinary ASCII inventory names", () => {
  assert.equal(normalizePresentationSetupInventoryValidationLabel("Roma\u0001Tomatoes"), null);
  assert.equal(normalizePresentationSetupInventoryValidationLabel("\u0007Basil"), null);

  assert.equal(presentationSetupInventoryValidationLabel("Basil Leaves"), "Basil Leaves");
  assert.equal(presentationSetupInventoryValidationLabel("  Olive Oil  "), "Olive Oil");
  assert.equal(presentationSetupInventoryValidationLabel("Crème Fraîche"), "Crème Fraîche");
});

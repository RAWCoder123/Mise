import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  asciiTrimPresentationSetupInventorySupplierRequiredLabel,
  canonicalizePresentationSetupInventorySupplierRequiredLabel,
  normalizePresentationSetupInventorySupplierRequiredLabel,
  presentationSetupInventorySupplierRequiredLabel
} from "../services/domain/presentationSetupInventorySupplierRequiredLabelIdentity";

test("MISE-005UM pins setup inventory supplier-required error labels to ASCII C", () => {
  const identitySource = readFileSync(
    "services/domain/presentationSetupInventorySupplierRequiredLabelIdentity.ts",
    "utf8"
  );
  const setupSource = readFileSync("services/application/setup.ts", "utf8");

  assert.match(identitySource, /MISE-005UM/);
  assert.match(setupSource, /MISE-005UM/);

  assert.match(
    identitySource,
    /export function asciiTrimPresentationSetupInventorySupplierRequiredLabel\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    setupSource,
    /presentationSetupInventorySupplierRequiredLabel\(item\.name\) \|\|\s*"Inventory item"/
  );
  assert.match(
    setupSource,
    /from "\.\.\/domain\/presentationSetupInventorySupplierRequiredLabelIdentity"/
  );

  // Leave prior Unicode supplier-required error label trim removed from validateSetupInput.
  assert.doesNotMatch(
    setupSource,
    /\$\{item\.name\.trim\(\) \|\| "Inventory item"\} requires a configured supplier/
  );

  // Do not share setup-screen inventory validation / durable inventory-name /
  // inventory-name key / recipe / ingredient / supplier chip modules.
  assert.doesNotMatch(
    identitySource,
    /presentationSetupInventoryValidationLabelIdentity|setupInventoryItemNameIdentity|normalizeSetupInventoryItemKey|presentationSetupRecipeValidationLabelIdentity|presentationSetupIngredientValidationLabelIdentity|presentationSetupSupplierChipLabelIdentity/
  );
  assert.doesNotMatch(
    setupSource,
    /presentationSetupInventoryValidationLabelIdentity|setupInventoryItemNameIdentity|presentationSetupRecipeValidationLabelIdentity|presentationSetupIngredientValidationLabelIdentity|presentationSetupSupplierChipLabelIdentity/
  );

  // Leave hasDraftData emptiness and quantity/par labels on their existing contracts.
  assert.match(
    setupSource,
    /item\.name\.trim\(\) \|\| item\.quantity\.trim\(\) \|\| item\.parLevel\.trim\(\) \|\| item\.supplierId\.trim\(\)/
  );
  assert.match(
    setupSource,
    /\$\{item\.name \|\| "Inventory item"\} quantity/
  );
  assert.match(
    setupSource,
    /\$\{item\.name \|\| "Inventory item"\} par level/
  );

  // Leave durable save-path draft.name.trim() alone (open #679).
  assert.match(setupSource, /const itemName = draft\.name\.trim\(\);/);

  const inventoryName = "Roma Tomatoes";
  assert.equal(
    asciiTrimPresentationSetupInventorySupplierRequiredLabel(`  ${inventoryName}  `),
    inventoryName
  );
  assert.equal(asciiTrimPresentationSetupInventorySupplierRequiredLabel(`\tRoma\n`), "Roma");
  assert.equal(
    normalizePresentationSetupInventorySupplierRequiredLabel(`  ${inventoryName}  `),
    inventoryName
  );
  assert.equal(
    canonicalizePresentationSetupInventorySupplierRequiredLabel(`  ${inventoryName}  `),
    inventoryName
  );
  assert.equal(
    presentationSetupInventorySupplierRequiredLabel(`  ${inventoryName}  `),
    inventoryName
  );

  // Soft empty / Unicode-only space preserves intentional English fallback.
  assert.equal(normalizePresentationSetupInventorySupplierRequiredLabel(""), null);
  assert.equal(normalizePresentationSetupInventorySupplierRequiredLabel("   "), null);
  assert.equal(normalizePresentationSetupInventorySupplierRequiredLabel("\u2003"), null);
  assert.equal(normalizePresentationSetupInventorySupplierRequiredLabel("\u00a0"), null);
  assert.equal(normalizePresentationSetupInventorySupplierRequiredLabel(null), null);
  assert.equal(normalizePresentationSetupInventorySupplierRequiredLabel(undefined), null);
  assert.equal(presentationSetupInventorySupplierRequiredLabel(null), null);
  assert.equal(presentationSetupInventorySupplierRequiredLabel("\u2003"), null);
});

test("MISE-005UM refuses Unicode-trim inventing of clean setup inventory supplier-required error labels", () => {
  const paddedName = "\u2003Roma Tomatoes\u2003";
  const nbspName = "\u00a0Roma Tomatoes\u00a0";

  // Inventing proof on prior Unicode trim path.
  assert.equal(paddedName.trim(), "Roma Tomatoes");
  assert.equal(nbspName.trim(), "Roma Tomatoes");
  assert.equal(paddedName.trim() || "Inventory item", "Roma Tomatoes");
  assert.equal("".trim() || "Inventory item", "Inventory item");
  assert.equal(
    `${paddedName.trim() || "Inventory item"} requires a configured supplier.`,
    "Roma Tomatoes requires a configured supplier."
  );

  // ASCII C prep leaves Unicode end padding alone and soft-nulls.
  assert.equal(asciiTrimPresentationSetupInventorySupplierRequiredLabel(paddedName), paddedName);
  assert.equal(asciiTrimPresentationSetupInventorySupplierRequiredLabel(nbspName), nbspName);
  assert.equal(canonicalizePresentationSetupInventorySupplierRequiredLabel(paddedName), null);
  assert.equal(canonicalizePresentationSetupInventorySupplierRequiredLabel(nbspName), null);
  assert.equal(normalizePresentationSetupInventorySupplierRequiredLabel(paddedName), null);
  assert.equal(normalizePresentationSetupInventorySupplierRequiredLabel(nbspName), null);
  assert.equal(presentationSetupInventorySupplierRequiredLabel(paddedName), null);
  assert.equal(presentationSetupInventorySupplierRequiredLabel(nbspName), null);

  // Soft-null preserves intentional English fallback without inventing.
  assert.equal(
    presentationSetupInventorySupplierRequiredLabel(paddedName) || "Inventory item",
    "Inventory item"
  );
  assert.equal(
    `${presentationSetupInventorySupplierRequiredLabel(paddedName) || "Inventory item"} requires a configured supplier.`,
    "Inventory item requires a configured supplier."
  );

  // Controls soft-null.
  assert.equal(
    normalizePresentationSetupInventorySupplierRequiredLabel("Roma\u0000Tomatoes"),
    null
  );
});

test("MISE-005UM preserves accents and case on clean setup inventory supplier-required error labels", () => {
  const accented = "Tomates Roma";
  assert.equal(presentationSetupInventorySupplierRequiredLabel(accented), accented);
  assert.equal(presentationSetupInventorySupplierRequiredLabel("  Café Beans  "), "Café Beans");
  assert.equal(presentationSetupInventorySupplierRequiredLabel("ROMA"), "ROMA");
});

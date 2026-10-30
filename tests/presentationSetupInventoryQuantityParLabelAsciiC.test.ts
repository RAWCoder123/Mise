import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  asciiTrimPresentationSetupInventoryQuantityParLabel,
  canonicalizePresentationSetupInventoryQuantityParLabel,
  normalizePresentationSetupInventoryQuantityParLabel,
  presentationSetupInventoryQuantityParLabel
} from "../services/domain/presentationSetupInventoryQuantityParLabelIdentity";

test("MISE-005UO pins setup inventory quantity/par assertBounded error labels to ASCII C", () => {
  const identitySource = readFileSync(
    "services/domain/presentationSetupInventoryQuantityParLabelIdentity.ts",
    "utf8"
  );
  const setupSource = readFileSync("services/application/setup.ts", "utf8");

  assert.match(identitySource, /MISE-005UO/);
  assert.match(setupSource, /MISE-005UO/);

  assert.match(
    identitySource,
    /export function asciiTrimPresentationSetupInventoryQuantityParLabel\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    setupSource,
    /presentationSetupInventoryQuantityParLabel\(item\.name\) \|\|\s*"Inventory item"/
  );
  assert.match(
    setupSource,
    /from "\.\.\/domain\/presentationSetupInventoryQuantityParLabelIdentity"/
  );
  assert.match(setupSource, /\$\{quantityParLabel\} quantity/);
  assert.match(setupSource, /\$\{quantityParLabel\} par level/);

  // Leave prior raw quantity/par label embedding removed from validateSetupInput.
  assert.doesNotMatch(
    setupSource,
    /\$\{item\.name \|\| "Inventory item"\} quantity/
  );
  assert.doesNotMatch(
    setupSource,
    /\$\{item\.name \|\| "Inventory item"\} par level/
  );

  // Do not share supplier-required / setup-screen inventory validation /
  // durable inventory-name / inventory-name key / recipe / ingredient /
  // supplier chip modules.
  assert.doesNotMatch(
    identitySource,
    /presentationSetupInventorySupplierRequiredLabelIdentity|presentationSetupInventoryValidationLabelIdentity|setupInventoryItemNameIdentity|normalizeSetupInventoryItemKey|presentationSetupRecipeValidationLabelIdentity|presentationSetupIngredientValidationLabelIdentity|presentationSetupSupplierChipLabelIdentity/
  );
  assert.doesNotMatch(
    setupSource,
    /presentationSetupInventorySupplierRequiredLabelIdentity|presentationSetupInventoryValidationLabelIdentity|setupInventoryItemNameIdentity|presentationSetupRecipeValidationLabelIdentity|presentationSetupIngredientValidationLabelIdentity|presentationSetupSupplierChipLabelIdentity/
  );

  // Leave hasDraftData emptiness and supplier-required inventing path alone
  // (open #977 / MISE-005UM owns supplier-required).
  assert.match(
    setupSource,
    /item\.name\.trim\(\) \|\| item\.quantity\.trim\(\) \|\| item\.parLevel\.trim\(\) \|\| item\.supplierId\.trim\(\)/
  );
  assert.match(
    setupSource,
    /\$\{item\.name\.trim\(\) \|\| "Inventory item"\} requires a configured supplier/
  );

  // Leave durable save-path draft.name.trim() alone (open #679).
  assert.match(setupSource, /const itemName = draft\.name\.trim\(\);/);

  // Leave recipe ingredient assertBounded labels alone.
  assert.match(
    setupSource,
    /\$\{ingredient\.itemName \|\| "Recipe ingredient"\} quantity per sale/
  );

  const inventoryName = "Roma Tomatoes";
  assert.equal(
    asciiTrimPresentationSetupInventoryQuantityParLabel(`  ${inventoryName}  `),
    inventoryName
  );
  assert.equal(asciiTrimPresentationSetupInventoryQuantityParLabel(`\tRoma\n`), "Roma");
  assert.equal(
    normalizePresentationSetupInventoryQuantityParLabel(`  ${inventoryName}  `),
    inventoryName
  );
  assert.equal(
    canonicalizePresentationSetupInventoryQuantityParLabel(`  ${inventoryName}  `),
    inventoryName
  );
  assert.equal(
    presentationSetupInventoryQuantityParLabel(`  ${inventoryName}  `),
    inventoryName
  );

  // Soft empty / Unicode-only space preserves intentional English fallback.
  assert.equal(normalizePresentationSetupInventoryQuantityParLabel(""), null);
  assert.equal(normalizePresentationSetupInventoryQuantityParLabel("   "), null);
  assert.equal(normalizePresentationSetupInventoryQuantityParLabel("\u2003"), null);
  assert.equal(normalizePresentationSetupInventoryQuantityParLabel("\u00a0"), null);
  assert.equal(normalizePresentationSetupInventoryQuantityParLabel(null), null);
  assert.equal(normalizePresentationSetupInventoryQuantityParLabel(undefined), null);
  assert.equal(presentationSetupInventoryQuantityParLabel(null), null);
  assert.equal(presentationSetupInventoryQuantityParLabel("\u2003"), null);
});

test("MISE-005UO refuses Unicode-trim inventing of clean setup inventory quantity/par error labels", () => {
  const paddedName = "\u2003Roma Tomatoes\u2003";
  const nbspName = "\u00a0Roma Tomatoes\u00a0";
  const unicodeOnlySpace = "\u2003";

  // Inventing proof: Unicode trim invents a clean inventory identity.
  assert.equal(paddedName.trim(), "Roma Tomatoes");
  assert.equal(nbspName.trim(), "Roma Tomatoes");
  assert.equal(paddedName.trim() || "Inventory item", "Roma Tomatoes");
  assert.equal(
    `${paddedName.trim() || "Inventory item"} quantity`,
    "Roma Tomatoes quantity"
  );
  assert.equal(
    `${paddedName.trim() || "Inventory item"} par level`,
    "Roma Tomatoes par level"
  );

  // Prior raw embedding: Unicode-only space is truthy and bypasses fallback.
  assert.equal(Boolean(unicodeOnlySpace), true);
  assert.equal(
    `${unicodeOnlySpace || "Inventory item"} quantity`,
    "\u2003 quantity"
  );
  assert.equal(
    `${unicodeOnlySpace || "Inventory item"} par level`,
    "\u2003 par level"
  );

  // ASCII C prep leaves Unicode end padding alone and soft-nulls.
  assert.equal(asciiTrimPresentationSetupInventoryQuantityParLabel(paddedName), paddedName);
  assert.equal(asciiTrimPresentationSetupInventoryQuantityParLabel(nbspName), nbspName);
  assert.equal(canonicalizePresentationSetupInventoryQuantityParLabel(paddedName), null);
  assert.equal(canonicalizePresentationSetupInventoryQuantityParLabel(nbspName), null);
  assert.equal(normalizePresentationSetupInventoryQuantityParLabel(paddedName), null);
  assert.equal(normalizePresentationSetupInventoryQuantityParLabel(nbspName), null);
  assert.equal(presentationSetupInventoryQuantityParLabel(paddedName), null);
  assert.equal(presentationSetupInventoryQuantityParLabel(nbspName), null);
  assert.equal(presentationSetupInventoryQuantityParLabel(unicodeOnlySpace), null);

  // Soft-null preserves intentional English fallback for quantity/par Errors.
  assert.equal(
    `${presentationSetupInventoryQuantityParLabel(paddedName) || "Inventory item"} quantity`,
    "Inventory item quantity"
  );
  assert.equal(
    `${presentationSetupInventoryQuantityParLabel(nbspName) || "Inventory item"} par level`,
    "Inventory item par level"
  );
  assert.equal(
    `${presentationSetupInventoryQuantityParLabel(unicodeOnlySpace) || "Inventory item"} quantity`,
    "Inventory item quantity"
  );
});

test("MISE-005UO fails closed on control-bearing setup inventory quantity/par error labels", () => {
  assert.equal(
    canonicalizePresentationSetupInventoryQuantityParLabel("Roma\u0000Tomatoes"),
    null
  );
  assert.equal(
    normalizePresentationSetupInventoryQuantityParLabel("Roma\u0007Tomatoes"),
    null
  );
  assert.equal(presentationSetupInventoryQuantityParLabel("Roma\u001fTomatoes"), null);
  assert.equal(presentationSetupInventoryQuantityParLabel(123 as unknown as string), null);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  asciiTrimPresentationSetupInventoryUnavailableSupplierLabel,
  canonicalizePresentationSetupInventoryUnavailableSupplierLabel,
  normalizePresentationSetupInventoryUnavailableSupplierLabel,
  presentationSetupInventoryUnavailableSupplierLabel
} from "../services/domain/presentationSetupInventoryUnavailableSupplierLabelIdentity";

test("MISE-005UX pins setup inventory unavailable-supplier error labels to ASCII C", () => {
  const identitySource = readFileSync(
    "services/domain/presentationSetupInventoryUnavailableSupplierLabelIdentity.ts",
    "utf8"
  );
  const setupSource = readFileSync("services/application/setup.ts", "utf8");

  assert.match(identitySource, /MISE-005UX/);
  assert.match(setupSource, /MISE-005UX/);

  assert.match(
    identitySource,
    /export function asciiTrimPresentationSetupInventoryUnavailableSupplierLabel\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    setupSource,
    /presentationSetupInventoryUnavailableSupplierLabel\(draft\.name\) \|\|\s*"Inventory item"/
  );
  assert.match(
    setupSource,
    /from "\.\.\/domain\/presentationSetupInventoryUnavailableSupplierLabelIdentity"/
  );

  // Leave prior Unicode unavailable-supplier error label inventing removed from save path.
  assert.doesNotMatch(
    setupSource,
    /\$\{itemName\} references an unavailable supplier/
  );

  // Do not share supplier-required / setup-screen validation / durable inventory-name /
  // inventory-name key / recipe / ingredient / supplier chip modules.
  assert.doesNotMatch(
    identitySource,
    /presentationSetupInventorySupplierRequiredLabelIdentity|presentationSetupInventoryValidationLabelIdentity|setupInventoryItemNameIdentity|normalizeSetupInventoryItemKey|presentationSetupRecipeValidationLabelIdentity|presentationSetupIngredientValidationLabelIdentity|presentationSetupSupplierChipLabelIdentity/
  );
  assert.doesNotMatch(
    setupSource,
    /presentationSetupInventorySupplierRequiredLabelIdentity|presentationSetupInventoryValidationLabelIdentity|setupInventoryItemNameIdentity|presentationSetupRecipeValidationLabelIdentity|presentationSetupIngredientValidationLabelIdentity|presentationSetupSupplierChipLabelIdentity/
  );

  // Leave durable save-path draft.name.trim() alone (open #679).
  assert.match(setupSource, /const itemName = draft\.name\.trim\(\);/);

  // Leave validateSetupInput supplier-required path on its existing contract (#977 owns tip).
  assert.match(
    setupSource,
    /\$\{item\.name\.trim\(\) \|\| "Inventory item"\} requires a configured supplier/
  );

  const inventoryName = "Roma Tomatoes";
  assert.equal(
    asciiTrimPresentationSetupInventoryUnavailableSupplierLabel(`  ${inventoryName}  `),
    inventoryName
  );
  assert.equal(asciiTrimPresentationSetupInventoryUnavailableSupplierLabel(`\tRoma\n`), "Roma");
  assert.equal(
    normalizePresentationSetupInventoryUnavailableSupplierLabel(`  ${inventoryName}  `),
    inventoryName
  );
  assert.equal(
    canonicalizePresentationSetupInventoryUnavailableSupplierLabel(`  ${inventoryName}  `),
    inventoryName
  );
  assert.equal(
    presentationSetupInventoryUnavailableSupplierLabel(`  ${inventoryName}  `),
    inventoryName
  );

  // Soft empty / Unicode-only space preserves intentional English fallback.
  assert.equal(normalizePresentationSetupInventoryUnavailableSupplierLabel(""), null);
  assert.equal(normalizePresentationSetupInventoryUnavailableSupplierLabel("   "), null);
  assert.equal(normalizePresentationSetupInventoryUnavailableSupplierLabel("\u2003"), null);
  assert.equal(normalizePresentationSetupInventoryUnavailableSupplierLabel("\u00a0"), null);
  assert.equal(normalizePresentationSetupInventoryUnavailableSupplierLabel(null), null);
  assert.equal(normalizePresentationSetupInventoryUnavailableSupplierLabel(undefined), null);
  assert.equal(presentationSetupInventoryUnavailableSupplierLabel(null), null);
  assert.equal(presentationSetupInventoryUnavailableSupplierLabel("\u2003"), null);
});

test("MISE-005UX refuses Unicode-trim inventing of clean setup inventory unavailable-supplier error labels", () => {
  const paddedName = "\u2003Roma Tomatoes\u2003";
  const nbspName = "\u00a0Roma Tomatoes\u00a0";

  // Inventing proof on prior Unicode trim path.
  assert.equal(paddedName.trim(), "Roma Tomatoes");
  assert.equal(nbspName.trim(), "Roma Tomatoes");
  assert.equal(
    `${paddedName.trim()} references an unavailable supplier.`,
    "Roma Tomatoes references an unavailable supplier."
  );

  // ASCII C prep leaves Unicode end padding alone and soft-nulls.
  assert.equal(asciiTrimPresentationSetupInventoryUnavailableSupplierLabel(paddedName), paddedName);
  assert.equal(asciiTrimPresentationSetupInventoryUnavailableSupplierLabel(nbspName), nbspName);
  assert.equal(canonicalizePresentationSetupInventoryUnavailableSupplierLabel(paddedName), null);
  assert.equal(canonicalizePresentationSetupInventoryUnavailableSupplierLabel(nbspName), null);
  assert.equal(normalizePresentationSetupInventoryUnavailableSupplierLabel(paddedName), null);
  assert.equal(normalizePresentationSetupInventoryUnavailableSupplierLabel(nbspName), null);
  assert.equal(presentationSetupInventoryUnavailableSupplierLabel(paddedName), null);
  assert.equal(presentationSetupInventoryUnavailableSupplierLabel(nbspName), null);

  // Soft-null preserves intentional English fallback without inventing.
  assert.equal(
    presentationSetupInventoryUnavailableSupplierLabel(paddedName) || "Inventory item",
    "Inventory item"
  );
  assert.equal(
    `${presentationSetupInventoryUnavailableSupplierLabel(paddedName) || "Inventory item"} references an unavailable supplier.`,
    "Inventory item references an unavailable supplier."
  );

  // Controls soft-null.
  assert.equal(
    normalizePresentationSetupInventoryUnavailableSupplierLabel("Roma\u0000Tomatoes"),
    null
  );
});

test("MISE-005UX preserves accents and case on clean setup inventory unavailable-supplier error labels", () => {
  const accented = "Tomates Roma";
  assert.equal(presentationSetupInventoryUnavailableSupplierLabel(accented), accented);
  assert.equal(presentationSetupInventoryUnavailableSupplierLabel("  Café Beans  "), "Café Beans");
  assert.equal(presentationSetupInventoryUnavailableSupplierLabel("ROMA"), "ROMA");
});

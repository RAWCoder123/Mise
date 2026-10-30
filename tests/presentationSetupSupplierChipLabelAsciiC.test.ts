import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  asciiTrimPresentationSetupSupplierChipLabel,
  canonicalizePresentationSetupSupplierChipLabel,
  normalizePresentationSetupSupplierChipLabel,
  presentationSetupSupplierChipLabel
} from "../services/domain/presentationSetupSupplierChipLabelIdentity";

test("MISE-005UI pins setup supplier ChoiceChip labels to ASCII C", () => {
  const identitySource = readFileSync(
    "services/domain/presentationSetupSupplierChipLabelIdentity.ts",
    "utf8"
  );
  const setupSource = readFileSync("app/(auth)/setup.tsx", "utf8");

  assert.match(
    identitySource,
    /export function asciiTrimPresentationSetupSupplierChipLabel\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    setupSource,
    /presentationSetupSupplierChipLabel\(supplier\.name\) \|\|\s*t\("setup\.validation\.supplierLabel"/
  );
  assert.match(
    setupSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationSetupSupplierChipLabelIdentity"/
  );

  // Leave prior Unicode supplier chip label trim removed from setup inventory chips.
  assert.doesNotMatch(
    setupSource,
    /const label = supplier\.name\.trim\(\) \|\| t\("setup\.validation\.supplierLabel"/
  );

  // Do not share durable supplierNames / setup-screen supplier / Login /
  // Create Task / supplier-draft-line modules.
  assert.doesNotMatch(
    setupSource,
    /setupSupplierNamesIdentity|setupScreenSupplierIdentity|presentationLoginEmailChipLabelIdentity|presentationCreateTaskAssigneeLabelIdentity|presentationSupplierDraftLineIdentity/
  );

  // Leave inventory / recipe / ingredient validation label inventing alone.
  assert.match(
    setupSource,
    /const label = item\.name\.trim\(\) \|\| t\("setup\.validation\.inventoryLabel"/
  );
  assert.match(
    setupSource,
    /const recipeLabel = recipe\.dishName\.trim\(\) \|\| t\("setup\.validation\.recipeLabel"/
  );
  assert.match(
    setupSource,
    /const ingredientLabel = ingredient\.itemName\.trim\(\) \|\| t\("setup\.validation\.ingredientLabel"/
  );

  const supplierName = "Fresh Farms";
  assert.equal(
    asciiTrimPresentationSetupSupplierChipLabel(`  ${supplierName}  `),
    supplierName
  );
  assert.equal(asciiTrimPresentationSetupSupplierChipLabel(`\tFresh\n`), "Fresh");
  assert.equal(
    normalizePresentationSetupSupplierChipLabel(`  ${supplierName}  `),
    supplierName
  );
  assert.equal(
    canonicalizePresentationSetupSupplierChipLabel(`  ${supplierName}  `),
    supplierName
  );
  assert.equal(
    presentationSetupSupplierChipLabel(`  ${supplierName}  `),
    supplierName
  );

  // Soft empty / Unicode-only space preserves intentional i18n supplierLabel fallback.
  assert.equal(normalizePresentationSetupSupplierChipLabel(""), null);
  assert.equal(normalizePresentationSetupSupplierChipLabel("   "), null);
  assert.equal(normalizePresentationSetupSupplierChipLabel("\u2003"), null);
  assert.equal(normalizePresentationSetupSupplierChipLabel("\u00a0"), null);
  assert.equal(normalizePresentationSetupSupplierChipLabel(null), null);
  assert.equal(normalizePresentationSetupSupplierChipLabel(undefined), null);
  assert.equal(presentationSetupSupplierChipLabel(null), null);
  assert.equal(presentationSetupSupplierChipLabel("\u2003"), null);
});

test("MISE-005UI refuses Unicode-trim inventing of clean setup supplier chip labels", () => {
  const paddedName = "\u2003Fresh Farms\u2003";
  const nbspName = "\u00a0Fresh Farms\u00a0";

  // Inventing proof on prior Unicode trim path.
  assert.equal(paddedName.trim(), "Fresh Farms");
  assert.equal(nbspName.trim(), "Fresh Farms");
  assert.equal(paddedName.trim() || "Supplier 1", "Fresh Farms");
  assert.equal("".trim() || "Supplier 1", "Supplier 1");

  // ASCII C prep leaves Unicode end padding alone and soft-nulls.
  assert.equal(asciiTrimPresentationSetupSupplierChipLabel(paddedName), paddedName);
  assert.equal(asciiTrimPresentationSetupSupplierChipLabel(nbspName), nbspName);
  assert.equal(canonicalizePresentationSetupSupplierChipLabel(paddedName), null);
  assert.equal(canonicalizePresentationSetupSupplierChipLabel(nbspName), null);
  assert.equal(normalizePresentationSetupSupplierChipLabel(paddedName), null);
  assert.equal(normalizePresentationSetupSupplierChipLabel(nbspName), null);
  assert.equal(presentationSetupSupplierChipLabel(paddedName), null);
  assert.equal(presentationSetupSupplierChipLabel(nbspName), null);
});

test("MISE-005UI soft-nulls controls and preserves ordinary ASCII supplier names", () => {
  assert.equal(normalizePresentationSetupSupplierChipLabel("Fresh\u0001Farms"), null);
  assert.equal(normalizePresentationSetupSupplierChipLabel("\u0007Sysco"), null);

  assert.equal(presentationSetupSupplierChipLabel("Sysco Produce"), "Sysco Produce");
  assert.equal(presentationSetupSupplierChipLabel("  Local Dairy  "), "Local Dairy");
  assert.equal(presentationSetupSupplierChipLabel("Café Verde"), "Café Verde");
});

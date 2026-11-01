import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimPresentationSetupFallbackLabel,
  canonicalizePresentationSetupFallbackLabel,
  normalizePresentationSetupFallbackLabel
} from "../services/domain/presentationSetupFallbackLabelIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationSetupFallbackLabelIdentity.ts", import.meta.url),
  "utf8"
);
const setupSource = readFileSync(new URL("../app/(auth)/setup.tsx", import.meta.url), "utf8");

const inventoryName = "Tomato";
const supplierName = "Fresh Farms";
const recipeName = "House Salad";
const ingredientName = "Romaine";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005VD pins setup.fallback.* remove / a11y labels to ASCII C", () => {
  assert.match(identitySource, /MISE-005VD/);
  assert.match(setupSource, /MISE-005VD/);

  assert.match(
    identitySource,
    /export function asciiTrimPresentationSetupFallbackLabel\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    setupSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationSetupFallbackLabelIdentity"/
  );
  assert.match(setupSource, /normalizePresentationSetupFallbackLabel\(/);

  // All seven setup.fallback.* interpolations route through soft-null prep.
  assert.match(
    setupSource,
    /normalizePresentationSetupFallbackLabel\(item\.name\) \|\|\s*t\("setup\.fallback\.inventory"\)/
  );
  assert.match(
    setupSource,
    /normalizePresentationSetupFallbackLabel\(supplier\.name\) \|\|\s*t\("setup\.fallback\.supplier"\)/
  );
  assert.equal(
    (
      setupSource.match(
        /normalizePresentationSetupFallbackLabel\(recipe\.dishName\) \|\|\s*t\("setup\.fallback\.recipe"\)/g
      ) ?? []
    ).length,
    3
  );
  assert.equal(
    (
      setupSource.match(
        /normalizePresentationSetupFallbackLabel\(ingredient\.itemName\) \|\|\s*t\("setup\.fallback\.ingredient"\)/g
      ) ?? []
    ).length,
    2
  );

  // Prior raw-truthy bypass paths must be gone.
  assert.doesNotMatch(setupSource, /item\.name \|\| t\("setup\.fallback\.inventory"\)/);
  assert.doesNotMatch(setupSource, /supplier\.name \|\| t\("setup\.fallback\.supplier"\)/);
  assert.doesNotMatch(setupSource, /recipe\.dishName \|\| t\("setup\.fallback\.recipe"\)/);
  assert.doesNotMatch(setupSource, /ingredient\.itemName \|\| t\("setup\.fallback\.ingredient"\)/);

  // Leave ChoiceChip, validation labels, and durable name paths alone.
  assert.match(
    setupSource,
    /const label = supplier\.name\.trim\(\) \|\| t\("setup\.validation\.supplierLabel"/
  );
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

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /setupInventoryItemNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationSetupSupplierChipLabelIdentity/);
  assert.doesNotMatch(identityCode, /setupScreenSupplierIdentity/);
  assert.doesNotMatch(identityCode, /setupSupplierNamesIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary setup.fallback.* labels stable", () => {
  assert.equal(asciiTrimPresentationSetupFallbackLabel(`  ${inventoryName}  `), inventoryName);
  assert.equal(asciiTrimPresentationSetupFallbackLabel(`\t${supplierName}\n`), supplierName);
  assert.equal(canonicalizePresentationSetupFallbackLabel(`  ${recipeName}  `), recipeName);
  assert.equal(normalizePresentationSetupFallbackLabel(`  ${ingredientName}  `), ingredientName);
  assert.equal(normalizePresentationSetupFallbackLabel("House Salad"), "House Salad");
});

test("Unicode-only space cannot bypass intentional setup.fallback.* copy", () => {
  const unicodeOnly = `${em}${em}`;
  const nbspOnly = `${nbsp}`;

  // Bypass proof: raw Unicode-only space is truthy and would skip setup.fallback.*.
  assert.equal(Boolean(unicodeOnly), true);
  assert.equal(Boolean(nbspOnly), true);
  assert.equal(Boolean(unicodeOnly || "FALLBACK"), true);
  assert.notEqual(unicodeOnly || "FALLBACK", "FALLBACK");

  // Soft-null restores the intentional localized fallback.
  assert.equal(normalizePresentationSetupFallbackLabel(unicodeOnly), null);
  assert.equal(normalizePresentationSetupFallbackLabel(nbspOnly), null);
  assert.equal(normalizePresentationSetupFallbackLabel(unicodeOnly) || "FALLBACK", "FALLBACK");
  assert.equal(normalizePresentationSetupFallbackLabel("   ") || "FALLBACK", "FALLBACK");
  assert.equal(normalizePresentationSetupFallbackLabel(""), null);
  assert.equal(normalizePresentationSetupFallbackLabel(null), null);
  assert.equal(normalizePresentationSetupFallbackLabel(undefined), null);
});

test("Unicode em-space / NBSP padding cannot invent clean setup.fallback.* labels", () => {
  const padded = `${em}${inventoryName}${em}`;
  const nbspName = `${nbsp}${supplierName}${nbsp}`;

  // Inventing proof: Unicode trim would invent the clean display label.
  assert.equal(padded.trim(), inventoryName);
  assert.equal(nbspName.trim(), supplierName);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);
  assert.equal(padded.trim() || "FALLBACK", inventoryName);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimPresentationSetupFallbackLabel(padded), padded);
  assert.equal(asciiTrimPresentationSetupFallbackLabel(nbspName), nbspName);
  assert.equal(canonicalizePresentationSetupFallbackLabel(padded), null);
  assert.equal(canonicalizePresentationSetupFallbackLabel(nbspName), null);
  assert.equal(normalizePresentationSetupFallbackLabel(padded), null);
  assert.equal(normalizePresentationSetupFallbackLabel(nbspName), null);
  assert.equal(normalizePresentationSetupFallbackLabel(padded) || "FALLBACK", "FALLBACK");
});

test("MISE-005VD soft-nulls controls and preserves ordinary ASCII labels", () => {
  assert.equal(normalizePresentationSetupFallbackLabel("Tomato\u0001Paste"), null);
  assert.equal(normalizePresentationSetupFallbackLabel("\u0007House Salad"), null);

  assert.equal(normalizePresentationSetupFallbackLabel("Tomato"), "Tomato");
  assert.equal(normalizePresentationSetupFallbackLabel("  Fresh Farms  "), "Fresh Farms");
  assert.equal(normalizePresentationSetupFallbackLabel("House Salad"), "House Salad");
  assert.equal(normalizePresentationSetupFallbackLabel("Romaine"), "Romaine");
});

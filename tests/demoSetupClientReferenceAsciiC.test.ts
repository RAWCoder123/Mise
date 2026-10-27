import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDemoSetupClientReference,
  canonicalizeDemoSetupClientReference,
  requireCanonicalDemoInventorySupplierSetupClientReference,
  requireCanonicalDemoSupplierSetupClientReference
} from "../services/domain/demoSetupClientReferenceIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/demoSetupClientReferenceIdentity.ts", import.meta.url),
  "utf8"
);
const demoRepositorySource = readFileSync(
  new URL("../services/repositories/demoRepository.ts", import.meta.url),
  "utf8"
);
const setupApplicationSource = readFileSync(
  new URL("../services/application/setup.ts", import.meta.url),
  "utf8"
);

const cleanReference = "supplier-1";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005SD pins demo setup client-reference identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005SD/);
  assert.match(demoRepositorySource, /MISE-005SD/);

  assert.match(
    identitySource,
    /export function asciiTrimDemoSetupClientReference\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    demoRepositorySource,
    /from "\.\.\/domain\/demoSetupClientReferenceIdentity"/
  );
  assert.match(
    demoRepositorySource,
    /requireCanonicalDemoSupplierSetupClientReference\(\s*supplierInput\.client_reference_id\s*\)/
  );
  assert.match(
    demoRepositorySource,
    /requireCanonicalDemoInventorySupplierSetupClientReference\(\s*inventoryInput\.supplier_client_reference_id\s*\)/
  );
  assert.doesNotMatch(
    demoRepositorySource,
    /supplierInput\.client_reference_id\.trim\(\)/
  );
  assert.doesNotMatch(
    demoRepositorySource,
    /inventoryInput\.supplier_client_reference_id\.trim\(\)/
  );

  // Leave open #769 application requireSetupReferenceId on Unicode trim alone.
  assert.doesNotMatch(setupApplicationSource, /demoSetupClientReferenceIdentity/);
  assert.match(
    setupApplicationSource,
    /const referenceId = typeof value === "string" \? value\.trim\(\) : ""/
  );

  // Do not rewrite sibling tips through this module.
  assert.doesNotMatch(identitySource, /setupReferenceIdentity/);
  assert.doesNotMatch(identitySource, /requireCanonicalSetupReferenceId/);
  assert.doesNotMatch(identitySource, /demoSupplierDisplayNameIdentity/);
  assert.doesNotMatch(identitySource, /demoPurchaseRecommendationIdIdentity/);
  assert.doesNotMatch(demoRepositorySource, /setupReferenceIdentity/);
});

test("ASCII whitespace still trims clean for demo setup client references", () => {
  assert.equal(asciiTrimDemoSetupClientReference(`  ${cleanReference}  `), cleanReference);
  assert.equal(asciiTrimDemoSetupClientReference(`\t${cleanReference}\n`), cleanReference);
  assert.equal(canonicalizeDemoSetupClientReference(`  ${cleanReference}  `), cleanReference);
  assert.equal(
    requireCanonicalDemoSupplierSetupClientReference(`  ${cleanReference}  `),
    cleanReference
  );
  assert.equal(
    requireCanonicalDemoInventorySupplierSetupClientReference(`\t${cleanReference}\n`),
    cleanReference
  );
  assert.equal(requireCanonicalDemoSupplierSetupClientReference(cleanReference), cleanReference);

  // Soft empty keeps prior empty-reject contracts.
  assert.equal(canonicalizeDemoSetupClientReference(""), null);
  assert.equal(canonicalizeDemoSetupClientReference("   "), null);
  assert.equal(canonicalizeDemoSetupClientReference("\t\n"), null);
  assert.equal(canonicalizeDemoSetupClientReference(em), null);
  assert.equal(canonicalizeDemoSetupClientReference(nbsp), null);
  assert.throws(
    () => requireCanonicalDemoSupplierSetupClientReference(""),
    /Supplier setup references must be unique\./
  );
  assert.throws(
    () => requireCanonicalDemoSupplierSetupClientReference(em),
    /Supplier setup references must be unique\./
  );
  assert.throws(
    () => requireCanonicalDemoInventorySupplierSetupClientReference("   "),
    /Inventory supplier setup reference is invalid\./
  );
  assert.throws(
    () => requireCanonicalDemoInventorySupplierSetupClientReference(nbsp),
    /Inventory supplier setup reference is invalid\./
  );
});

test("Unicode-padded demo setup client references fail closed instead of inventing", () => {
  // Prior Unicode trim invented a clean durable setup Map key.
  assert.equal(`${em}${cleanReference}${em}`.trim(), cleanReference);
  assert.throws(
    () => requireCanonicalDemoSupplierSetupClientReference(`${em}${cleanReference}${em}`),
    /Supplier setup references must be unique\./
  );
  assert.equal(canonicalizeDemoSetupClientReference(`${em}${cleanReference}${em}`), null);

  assert.equal(`${nbsp}${cleanReference}${nbsp}`.trim(), cleanReference);
  assert.throws(
    () =>
      requireCanonicalDemoInventorySupplierSetupClientReference(
        `${nbsp}${cleanReference}${nbsp}`
      ),
    /Inventory supplier setup reference is invalid\./
  );

  assert.throws(
    () => requireCanonicalDemoSupplierSetupClientReference(`${cleanReference}\u0000`),
    /Supplier setup references must be unique\./
  );
  assert.throws(
    () => requireCanonicalDemoInventorySupplierSetupClientReference(42),
    /Inventory supplier setup reference is invalid\./
  );
});

test("demo saveRestaurantSetupSnapshot fails closed on Unicode-padded client references", async () => {
  const values = new Map<string, string>();
  (globalThis as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
      clear: () => {
        values.clear();
      },
      key: (index) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      }
    }
  };

  const { createLocalDemoRepository } = await import("../services/repositories/demoRepository");
  const repository = createLocalDemoRepository();
  const restaurant = await repository.resetDemoData(null);

  await assert.rejects(
    repository.saveRestaurantSetupSnapshot(restaurant.id, {
      inventoryItems: [],
      suppliers: [
        {
          restaurant_id: restaurant.id,
          client_reference_id: `${em}${cleanReference}${em}`,
          display_name: "Ascii C Setup Supplier",
          email: "orders@ascii-c-setup.test"
        }
      ],
      recipeMappings: [],
      posSales: [],
      attachments: [],
      skippedRecipeIngredients: 0
    }),
    /Supplier setup references must be unique\./
  );

  // Clean ASCII reference still binds inventory through the same Map key.
  values.clear();
  const fresh = await repository.resetDemoData(null);
  await repository.saveRestaurantSetupSnapshot(fresh.id, {
    inventoryItems: [
      {
        restaurant_id: fresh.id,
        item_name: "Ascii C Tomatoes",
        category: "Setup baseline",
        unit: "case",
        current_quantity: 4,
        par_level: 12,
        reorder_threshold: 4,
        estimated_unit_cost: 20,
        supplier_client_reference_id: cleanReference
      }
    ],
    suppliers: [
      {
        restaurant_id: fresh.id,
        client_reference_id: cleanReference,
        display_name: "Ascii C Setup Supplier",
        email: "orders@ascii-c-setup.test"
      }
    ],
    recipeMappings: [],
    posSales: [],
    attachments: [],
    skippedRecipeIngredients: 0
  });
  const items = await repository.fetchInventoryItems(fresh.id);
  assert.ok(items.some((item) => item.item_name === "Ascii C Tomatoes"));
});

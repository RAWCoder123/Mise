import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInventoryDetailCategory,
  canonicalizeInventoryDetailCategory,
  normalizeInventoryDetailCategory
} from "../services/domain/presentationInventoryDetailCategoryIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationInventoryDetailCategoryIdentity.ts", import.meta.url),
  "utf8"
);
const detailSource = readFileSync(new URL("../app/inventory/[id].tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const supplierIdentityPath = new URL(
  "../services/domain/presentationInventoryDetailSupplierNameIdentity.ts",
  import.meta.url
);
const hubItemIdentityPath = new URL(
  "../services/domain/presentationInventoryHubItemNameIdentity.ts",
  import.meta.url
);
const categoryIconPath = new URL(
  "../services/domain/presentationInventoryCategoryIconIdentity.ts",
  import.meta.url
);

const category = "Produce";
const em = "\u2003";
const nbsp = "\u00a0";

function filePresence(path: URL) {
  try {
    readFileSync(path, "utf8");
    return "present";
  } catch {
    return "absent";
  }
}

test("MISE-005AAD pins Inventory detail category to ASCII C", () => {
  assert.match(identitySource, /MISE-005AAD/);
  assert.match(detailSource, /MISE-005AAD/);

  assert.match(
    identitySource,
    /export function asciiTrimInventoryDetailCategory\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    detailSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationInventoryDetailCategoryIdentity"/
  );
  assert.match(detailSource, /normalizeInventoryDetailCategory\(/);
  assert.match(
    detailSource,
    /normalizeInventoryDetailCategory\(\s*item\.category\s*\)\s*\|\|\s*t\("inventory\.detail\.category\.none"\)/
  );
  assert.doesNotMatch(
    detailSource,
    /subtitle=\{item \? `\$\{item\.supplier_name\} · \$\{item\.category\}`/
  );

  assert.match(catalogSource, /"inventory\.detail\.category\.none": "Category"/);
  assert.match(catalogSource, /"inventory\.detail\.category\.none": "Categoría"/);
  assert.match(catalogSource, /"inventory\.detail\.category\.none": "类别"/);

  // Leave sibling supplier_name / title / hub / categoryIcon tips alone on this tip.
  assert.doesNotMatch(detailSource, /normalizeInventoryDetailSupplierName/);
  assert.doesNotMatch(detailSource, /normalizeInventoryHubItemName/);
  assert.doesNotMatch(identitySource, /presentationInventoryDetailSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryHubItemNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.equal(filePresence(supplierIdentityPath), "absent");
  assert.equal(filePresence(hubItemIdentityPath), "absent");
  assert.equal(filePresence(categoryIconPath), "absent");

  // Leave Inventory detail title item.item_name and supplier_name alone.
  assert.match(detailSource, /title=\{item\?\.item_name \?\? t\("inventory\.detail\.title"\)\}/);
  assert.match(
    detailSource,
    /`\$\{item\.supplier_name\} · \$\{inventoryDetailDisplayCategory\}`/
  );

  assert.equal(normalizeInventoryDetailCategory(category), category);
  assert.equal(normalizeInventoryDetailCategory(` ${category} `), category);
  assert.equal(
    normalizeInventoryDetailCategory(`Fresh ${category}`),
    `Fresh ${category}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Inventory detail categories", () => {
  const padded = `${em}${category}${em}`;
  const nbspName = `${nbsp}${category}${nbsp}`;
  const internalEm = `Pro${em}duce`;
  const internalNbsp = `Pro${nbsp}duce`;

  // Inventing proof: Unicode trim would invent the clean category.
  assert.equal(padded.trim(), category);
  assert.equal(nbspName.trim(), category);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimInventoryDetailCategory(padded), padded);
  assert.equal(canonicalizeInventoryDetailCategory(padded), null);
  assert.equal(canonicalizeInventoryDetailCategory(nbspName), null);
  assert.equal(normalizeInventoryDetailCategory(padded), null);
  assert.equal(normalizeInventoryDetailCategory(nbspName), null);
  assert.equal(normalizeInventoryDetailCategory(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeInventoryDetailCategory(internalEm), internalEm);
  assert.equal(normalizeInventoryDetailCategory(internalNbsp), internalNbsp);
  assert.equal(normalizeInventoryDetailCategory(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Inventory detail categories", () => {
  assert.equal(normalizeInventoryDetailCategory(undefined), null);
  assert.equal(normalizeInventoryDetailCategory(null), null);
  assert.equal(normalizeInventoryDetailCategory(""), null);
  assert.equal(normalizeInventoryDetailCategory("   "), null);
  assert.equal(normalizeInventoryDetailCategory(123 as unknown as string), null);
  assert.equal(normalizeInventoryDetailCategory(`\u0001${category}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeInventoryDetailCategory(`${category}\t`), category);
  assert.equal(normalizeInventoryDetailCategory(`${category}\u0007`), null);
  assert.equal(normalizeInventoryDetailCategory(em), null);
});

test("Inventory detail bypass proof: empty and Unicode-only-space categories soft-null to localized none", () => {
  // Prior always-pass-name path still rendered blank-looking category after
  // the supplier separator (`"Sysco · "` / `"Sysco ·  "`).
  assert.equal(normalizeInventoryDetailCategory(""), null);
  assert.equal(normalizeInventoryDetailCategory(em), null);
  assert.equal(normalizeInventoryDetailCategory(nbsp), null);
  assert.match(
    detailSource,
    /normalizeInventoryDetailCategory\(\s*item\.category\s*\)\s*\|\|\s*t\("inventory\.detail\.category\.none"\)/
  );
});

test("Inventory detail category identity refuses Unicode inventing equality", () => {
  const padded = `${em}${category}${em}`;
  assert.notEqual(asciiTrimInventoryDetailCategory(padded), padded.trim());
  assert.equal(normalizeInventoryDetailCategory(padded), null);
  assert.equal(normalizeInventoryDetailCategory(`\t${category}\n`), category);
});

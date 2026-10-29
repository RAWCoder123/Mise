import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  asciiTrimInventoryCountLineItemToken,
  canonicalizeInventoryCountLineItemId,
  INVENTORY_COUNT_LINE_ITEM_ID_MAX_CHARACTERS,
  requireCanonicalInventoryCountLineItemId
} from "../services/domain/inventoryCountLineItemIdentity";
import { requireInventoryCountLineUpdates } from "../services/miseValidation";

const em = "\u2003";
const nbsp = "\u00a0";
const inventoryItemId = "tomatoes";

const identitySource = readFileSync(
  join(process.cwd(), "services/domain/inventoryCountLineItemIdentity.ts"),
  "utf8"
);
const validationSource = readFileSync(
  join(process.cwd(), "services/miseValidation.ts"),
  "utf8"
);

test("MISE-005TT pins miseValidation count-line inventoryItemId to ASCII C", () => {
  assert.match(
    validationSource,
    /requireCanonicalInventoryCountLineItemId\(\s*row\.inventoryItemId\s*\?\?\s*row\.inventory_item_id\s*,\s*index\s*\+\s*1\s*\)/
  );
  assert.doesNotMatch(
    validationSource,
    /String\(row\.inventoryItemId\s*\?\?\s*row\.inventory_item_id\s*\?\?\s*""\)\.trim\(\)/
  );
  assert.match(validationSource, /inventoryCountLineItemIdentity/);
  assert.doesNotMatch(validationSource, /inventoryCountItemIdentity/);
  assert.doesNotMatch(validationSource, /inventoryOperationScopeIdentity/);
  assert.doesNotMatch(validationSource, /from "\.\/domain\/inventoryItemIdentity"/);
  assert.doesNotMatch(identitySource, /from "\.\/inventoryCountItemIdentity"/);
  assert.doesNotMatch(identitySource, /from "\.\/inventoryOperationScopeIdentity"/);
  assert.doesNotMatch(identitySource, /from "\.\/inventoryItemIdentity"/);
});

test("ASCII end trim preserves clean tokens and refuses Unicode inventing", () => {
  assert.equal(
    asciiTrimInventoryCountLineItemToken(`  ${inventoryItemId}  `),
    inventoryItemId
  );
  assert.equal(
    asciiTrimInventoryCountLineItemToken(`\t${inventoryItemId}\n`),
    inventoryItemId
  );
  assert.equal(
    asciiTrimInventoryCountLineItemToken(`${em}${inventoryItemId}${em}`),
    `${em}${inventoryItemId}${em}`
  );
  assert.equal(
    canonicalizeInventoryCountLineItemId(`  ${inventoryItemId}  `),
    inventoryItemId
  );
  assert.equal(canonicalizeInventoryCountLineItemId(`${em}${inventoryItemId}${em}`), null);
  assert.equal(canonicalizeInventoryCountLineItemId(`${nbsp}${inventoryItemId}${nbsp}`), null);
  assert.equal(canonicalizeInventoryCountLineItemId(em), null);
  assert.equal(canonicalizeInventoryCountLineItemId(""), null);
  assert.equal(
    canonicalizeInventoryCountLineItemId("x".repeat(INVENTORY_COUNT_LINE_ITEM_ID_MAX_CHARACTERS + 1)),
    null
  );
  assert.equal(canonicalizeInventoryCountLineItemId("bad\u0000id"), null);

  assert.equal(
    requireCanonicalInventoryCountLineItemId(`  ${inventoryItemId}  `, 1),
    inventoryItemId
  );
  assert.throws(
    () => requireCanonicalInventoryCountLineItemId(`${em}${inventoryItemId}${em}`, 2),
    /Count line 2 is missing an inventory item\./
  );
  assert.throws(
    () => requireCanonicalInventoryCountLineItemId(`${nbsp}${inventoryItemId}${nbsp}`, 3),
    /Count line 3 is missing an inventory item\./
  );
  assert.throws(
    () => requireCanonicalInventoryCountLineItemId(null, 4),
    /Count line 4 is missing an inventory item\./
  );
  assert.throws(
    () => requireCanonicalInventoryCountLineItemId(12, 5),
    /Count line 5 is missing an inventory item\./
  );
});

test("requireInventoryCountLineUpdates fail-closes Unicode-padded inventoryItemId", () => {
  const clean = requireInventoryCountLineUpdates([
    { inventoryItemId: `  ${inventoryItemId}  `, countedQuantity: 4, note: null }
  ]);
  assert.equal(clean[0]?.inventoryItemId, inventoryItemId);

  const snake = requireInventoryCountLineUpdates([
    { inventory_item_id: `  flour  `, counted_quantity: 1, note: null }
  ]);
  assert.equal(snake[0]?.inventoryItemId, "flour");

  assert.throws(
    () =>
      requireInventoryCountLineUpdates([
        {
          inventoryItemId: `${em}${inventoryItemId}${em}`,
          countedQuantity: 2,
          note: null
        }
      ]),
    /Count line 1 is missing an inventory item\./
  );

  assert.throws(
    () =>
      requireInventoryCountLineUpdates([
        {
          inventoryItemId: `${nbsp}${inventoryItemId}${nbsp}`,
          countedQuantity: 2,
          note: null
        }
      ]),
    /Count line 1 is missing an inventory item\./
  );

  assert.throws(
    () =>
      requireInventoryCountLineUpdates([
        { inventoryItemId: inventoryItemId, countedQuantity: 1, note: null },
        { inventoryItemId: `  ${inventoryItemId}  `, countedQuantity: 2, note: null }
      ]),
    /Count line 2 duplicates an inventory item\./
  );

  // Prove prior Unicode trim would have invented equality with the clean key.
  assert.equal(`${em}${inventoryItemId}${em}`.trim(), inventoryItemId);
  assert.equal(`${nbsp}${inventoryItemId}${nbsp}`.trim(), inventoryItemId);
});

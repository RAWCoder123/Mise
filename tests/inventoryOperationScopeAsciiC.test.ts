import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInventoryOperationScopeToken,
  canonicalizeInventoryOperationScopeToken,
  requireCanonicalInventoryOperationInventoryItemId,
  requireCanonicalInventoryOperationRestaurantId
} from "../services/domain/inventoryOperationScopeIdentity";
import {
  INVENTORY_OPERATION_INVENTORY_ITEM_ID_MAX_CHARACTERS,
  INVENTORY_OPERATION_RESTAURANT_ID_MAX_CHARACTERS
} from "../services/domain/securityLimits";
import { requireInventoryOperation } from "../services/miseValidation";

const identitySource = readFileSync(
  new URL("../services/domain/inventoryOperationScopeIdentity.ts", import.meta.url),
  "utf8"
);
const validationSource = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);
const limitsSource = readFileSync(
  new URL("../services/domain/securityLimits.ts", import.meta.url),
  "utf8"
);

const restaurantId = "restaurant-a";
const inventoryItemId = "chicken";
const em = "\u2003";
const nbsp = "\u00a0";

const base = {
  restaurantId,
  inventoryItemId,
  eventType: "receipt",
  quantity: 1250,
  canonicalUnit: "g",
  effectiveAt: "2026-07-26T10:00:00.000Z"
} as const;

test("MISE-005PZ pins inventory-operation restaurantId/inventoryItemId to ASCII C", () => {
  assert.match(identitySource, /MISE-005PZ/);
  assert.match(validationSource, /MISE-005PZ/);
  assert.match(limitsSource, /INVENTORY_OPERATION_RESTAURANT_ID_MAX_CHARACTERS = 200/);
  assert.match(
    limitsSource,
    /INVENTORY_OPERATION_INVENTORY_ITEM_ID_MAX_CHARACTERS = 200/
  );

  assert.match(
    identitySource,
    /export function asciiTrimInventoryOperationScopeToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    validationSource,
    /requireCanonicalInventoryOperationRestaurantId\(\s*input\.restaurantId\s*\)/
  );
  assert.match(
    validationSource,
    /requireCanonicalInventoryOperationInventoryItemId\(\s*input\.inventoryItemId\s*\)/
  );
  assert.match(
    validationSource,
    /from "\.\/domain\/inventoryOperationScopeIdentity"/
  );

  // Leave sibling optionalBoundedText evidence on Unicode trim in this tip.
  assert.match(
    validationSource,
    /optionalBoundedText\(input\.sourceReference, "reference", 200\)/
  );
  assert.match(
    validationSource,
    /optionalBoundedText\(input\.reasonCode, "reason", 80\)/
  );
  assert.match(validationSource, /optionalBoundedText\(input\.note, "note", 500\)/);

  // Dead requireBoundedText must not remain after routing both required IDs.
  assert.doesNotMatch(validationSource, /function requireBoundedText\(/);

  // Do not share sibling tip modules.
  assert.doesNotMatch(identitySource, /inventoryOperationNoteIdentity/);
  assert.doesNotMatch(identitySource, /inventoryOperationReferenceIdentity/);
  assert.doesNotMatch(identitySource, /inventoryLedgerRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /inventoryLedgerObjectIdentity/);
  assert.doesNotMatch(identitySource, /inventoryItemIdentity/);
  assert.doesNotMatch(identitySource, /inventoryCountItemIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\/inventoryOperationNoteIdentity"/);
  assert.doesNotMatch(identitySource, /from "\.\/inventoryOperationReferenceIdentity"/);
  assert.doesNotMatch(validationSource, /inventoryOperationNoteIdentity/);
  assert.doesNotMatch(validationSource, /inventoryOperationReferenceIdentity/);
});

test("ASCII trim keeps ordinary inventory-operation scope padding stable", () => {
  assert.equal(
    asciiTrimInventoryOperationScopeToken(`  ${restaurantId}  `),
    restaurantId
  );
  assert.equal(
    canonicalizeInventoryOperationScopeToken(
      `\t${restaurantId}\n`,
      INVENTORY_OPERATION_RESTAURANT_ID_MAX_CHARACTERS
    ),
    restaurantId
  );
  assert.equal(
    requireCanonicalInventoryOperationRestaurantId(`  ${restaurantId}  `),
    restaurantId
  );

  assert.equal(
    asciiTrimInventoryOperationScopeToken(`  ${inventoryItemId}  `),
    inventoryItemId
  );
  assert.equal(
    canonicalizeInventoryOperationScopeToken(
      `\t${inventoryItemId}\n`,
      INVENTORY_OPERATION_INVENTORY_ITEM_ID_MAX_CHARACTERS
    ),
    inventoryItemId
  );
  assert.equal(
    requireCanonicalInventoryOperationInventoryItemId(`  ${inventoryItemId}  `),
    inventoryItemId
  );

  const operation = requireInventoryOperation({
    ...base,
    restaurantId: `  ${restaurantId}  `,
    inventoryItemId: `  ${inventoryItemId}  `
  });
  assert.equal(operation.restaurantId, restaurantId);
  assert.equal(operation.inventoryItemId, inventoryItemId);
});

test("Unicode em-space / NBSP padding cannot invent clean restaurant or inventory item", () => {
  const paddedRestaurant = `${em}${restaurantId}${em}`;
  const paddedItem = `${em}${inventoryItemId}${em}`;
  const nbspRestaurant = `${nbsp}${restaurantId}${nbsp}`;
  const nbspItem = `${nbsp}${inventoryItemId}${nbsp}`;

  // Inventing proof: Unicode trim would invent the clean scope identity.
  assert.equal(paddedRestaurant.trim(), restaurantId);
  assert.equal(paddedItem.trim(), inventoryItemId);
  assert.equal(nbspRestaurant.trim(), restaurantId);
  assert.equal(nbspItem.trim(), inventoryItemId);

  // ASCII C prep refuses that inventing equality.
  assert.equal(
    asciiTrimInventoryOperationScopeToken(paddedRestaurant),
    paddedRestaurant
  );
  assert.equal(
    canonicalizeInventoryOperationScopeToken(
      paddedRestaurant,
      INVENTORY_OPERATION_RESTAURANT_ID_MAX_CHARACTERS
    ),
    null
  );
  assert.equal(
    canonicalizeInventoryOperationScopeToken(
      nbspRestaurant,
      INVENTORY_OPERATION_RESTAURANT_ID_MAX_CHARACTERS
    ),
    null
  );
  assert.equal(
    canonicalizeInventoryOperationScopeToken(
      paddedItem,
      INVENTORY_OPERATION_INVENTORY_ITEM_ID_MAX_CHARACTERS
    ),
    null
  );
  assert.equal(
    canonicalizeInventoryOperationScopeToken(
      nbspItem,
      INVENTORY_OPERATION_INVENTORY_ITEM_ID_MAX_CHARACTERS
    ),
    null
  );

  assert.throws(
    () => requireCanonicalInventoryOperationRestaurantId(paddedRestaurant),
    /Enter a valid restaurant\./
  );
  assert.throws(
    () => requireCanonicalInventoryOperationInventoryItemId(paddedItem),
    /Enter a valid inventory item\./
  );
  assert.throws(
    () => requireCanonicalInventoryOperationRestaurantId(nbspRestaurant),
    /Enter a valid restaurant\./
  );
  assert.throws(
    () => requireCanonicalInventoryOperationInventoryItemId(nbspItem),
    /Enter a valid inventory item\./
  );

  assert.throws(
    () =>
      requireInventoryOperation({
        ...base,
        restaurantId: paddedRestaurant
      }),
    /Enter a valid restaurant\./
  );
  assert.throws(
    () =>
      requireInventoryOperation({
        ...base,
        inventoryItemId: paddedItem
      }),
    /Enter a valid inventory item\./
  );

  // Internal em-space is not end-padding inventing; keep the operator token.
  const internalEmRestaurant = `restaurant${em}a`;
  const internalEmItem = `chick${em}en`;
  assert.equal(
    canonicalizeInventoryOperationScopeToken(
      internalEmRestaurant,
      INVENTORY_OPERATION_RESTAURANT_ID_MAX_CHARACTERS
    ),
    internalEmRestaurant
  );
  assert.notEqual(
    canonicalizeInventoryOperationScopeToken(
      internalEmRestaurant,
      INVENTORY_OPERATION_RESTAURANT_ID_MAX_CHARACTERS
    ),
    restaurantId
  );
  assert.equal(
    canonicalizeInventoryOperationScopeToken(
      internalEmItem,
      INVENTORY_OPERATION_INVENTORY_ITEM_ID_MAX_CHARACTERS
    ),
    internalEmItem
  );
  assert.notEqual(
    canonicalizeInventoryOperationScopeToken(
      internalEmItem,
      INVENTORY_OPERATION_INVENTORY_ITEM_ID_MAX_CHARACTERS
    ),
    inventoryItemId
  );

  // Kelvin is not folded; case stays presentation-faithful.
  assert.equal(
    canonicalizeInventoryOperationScopeToken(
      "Kelvin-restaurant",
      INVENTORY_OPERATION_RESTAURANT_ID_MAX_CHARACTERS
    ),
    "Kelvin-restaurant"
  );
  assert.notEqual(
    canonicalizeInventoryOperationScopeToken(
      "Kelvin-restaurant",
      INVENTORY_OPERATION_RESTAURANT_ID_MAX_CHARACTERS
    ),
    canonicalizeInventoryOperationScopeToken(
      "Kelvin-restaurant",
      INVENTORY_OPERATION_RESTAURANT_ID_MAX_CHARACTERS
    )
  );
});

test("inventory-operation scope empty/control/over-long fail closed; siblings still Unicode-trim", () => {
  assert.throws(
    () => requireCanonicalInventoryOperationRestaurantId(""),
    /Enter a valid restaurant\./
  );
  assert.throws(
    () => requireCanonicalInventoryOperationRestaurantId("   "),
    /Enter a valid restaurant\./
  );
  assert.throws(
    () => requireCanonicalInventoryOperationRestaurantId(`${em}${em}`),
    /Enter a valid restaurant\./
  );
  assert.throws(
    () => requireCanonicalInventoryOperationInventoryItemId(""),
    /Enter a valid inventory item\./
  );
  assert.throws(
    () => requireCanonicalInventoryOperationInventoryItemId(`${nbsp}`),
    /Enter a valid inventory item\./
  );

  assert.throws(
    () => requireCanonicalInventoryOperationRestaurantId("x".repeat(201)),
    /Enter a valid restaurant\./
  );
  assert.throws(
    () => requireCanonicalInventoryOperationInventoryItemId("x".repeat(201)),
    /Enter a valid inventory item\./
  );
  assert.throws(
    () =>
      requireInventoryOperation({
        ...base,
        restaurantId: "x".repeat(201)
      }),
    /Enter a valid restaurant\./
  );
  assert.throws(
    () =>
      requireInventoryOperation({
        ...base,
        inventoryItemId: "x".repeat(201)
      }),
    /Enter a valid inventory item\./
  );

  assert.throws(
    () => requireCanonicalInventoryOperationRestaurantId("bad\u0000restaurant"),
    /Enter a valid restaurant\./
  );
  assert.throws(
    () => requireCanonicalInventoryOperationInventoryItemId("bad\u0007item"),
    /Enter a valid inventory item\./
  );
  assert.throws(
    () => requireCanonicalInventoryOperationRestaurantId(42),
    /Enter a valid restaurant\./
  );
  assert.throws(
    () => requireCanonicalInventoryOperationInventoryItemId(false),
    /Enter a valid inventory item\./
  );

  // Sibling optionalBoundedText paths still Unicode-trim on main in this tip.
  const sibling = requireInventoryOperation({
    ...base,
    sourceReference: " invoice-42 ",
    reasonCode: " delivery ",
    note: " Chilled on arrival "
  });
  assert.equal(sibling.sourceReference, "invoice-42");
  assert.equal(sibling.reasonCode, "delivery");
  assert.deepEqual(sibling.metadata, { note: "Chilled on arrival" });
});

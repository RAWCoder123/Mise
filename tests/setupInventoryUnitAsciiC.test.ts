import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSetupInventoryUnitToken,
  canonicalizeSetupInventoryUnit,
  canonicalizeSetupInventoryUnitToken,
  normalizeCanonicalSetupInventoryUnit,
  requireCanonicalSetupInventoryUnit,
  SETUP_INVENTORY_UNIT_DEFAULT
} from "../services/domain/setupInventoryUnitIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/setupInventoryUnitIdentity.ts", import.meta.url),
  "utf8"
);
const setupSource = readFileSync(
  new URL("../services/application/setup.ts", import.meta.url),
  "utf8"
);
const inventoryUnitsSource = readFileSync(
  new URL("../services/domain/inventoryUnits.ts", import.meta.url),
  "utf8"
);
const draftsSource = readFileSync(
  new URL("../services/domain/setupDrafts.ts", import.meta.url),
  "utf8"
);

const unit = "lb";
const accentedUnit = "litros";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005QA pins setup inventory units to ASCII C", () => {
  assert.match(identitySource, /MISE-005QA/);
  assert.match(setupSource, /MISE-005QA/);

  assert.match(
    identitySource,
    /export function asciiTrimSetupInventoryUnitToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    setupSource,
    /normalizeCanonicalSetupInventoryUnit\(draft\.unit\) \?\?\s*SETUP_INVENTORY_UNIT_DEFAULT/
  );
  assert.match(
    setupSource,
    /normalizeCanonicalSetupInventoryUnit\(ingredient\.unit\) \?\?\s*SETUP_INVENTORY_UNIT_DEFAULT/
  );
  assert.match(setupSource, /from "\.\.\/domain\/setupInventoryUnitIdentity"/);
  assert.doesNotMatch(setupSource, /draft\.unit\.trim\(\)\s*\|\|\s*"unit"/);
  assert.doesNotMatch(setupSource, /ingredient\.unit\.trim\(\)\s*\|\|\s*"unit"/);

  // Leave sibling inventoryUnits fold, draft emptiness, and other setup field
  // trims alone for their open tips.
  assert.match(inventoryUnitsSource, /export function canonicalInventoryUnit/);
  assert.match(draftsSource, /export interface SetupInventoryDraftItem/);
  assert.match(setupSource, /const normalizedRestaurantId = restaurantId\.trim\(\);/);
  assert.match(setupSource, /const itemName = draft\.name\.trim\(\);/);
  assert.match(setupSource, /const menuItemName = recipe\.dishName\.trim\(\);/);
  assert.match(setupSource, /const ingredientName = ingredient\.itemName\.trim\(\);/);
  assert.match(setupSource, /label: attachment\.label\.trim\(\) \|\| "Setup reference"/);
  assert.match(setupSource, /supplier\.name\.trim\(\) \|\| supplier\.email\.trim\(\)/);

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /setupAttachmentLabelIdentity/);
  assert.doesNotMatch(identitySource, /setupRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*inventoryUnits["']/);
  assert.doesNotMatch(identitySource, /from "\.\.\/miseValidation"/);
  assert.doesNotMatch(setupSource, /canonicalInventoryUnit\(/);
});

test("ASCII C prep keeps ordinary setup inventory units stable", () => {
  assert.equal(asciiTrimSetupInventoryUnitToken(`  ${unit}  `), unit);
  assert.equal(asciiTrimSetupInventoryUnitToken(`\t${unit}\n`), unit);
  assert.equal(canonicalizeSetupInventoryUnitToken(`  ${unit}  `), unit);
  assert.equal(canonicalizeSetupInventoryUnit(`  ${unit}  `), unit);
  assert.equal(normalizeCanonicalSetupInventoryUnit(`  ${unit}  `), unit);
  assert.equal(requireCanonicalSetupInventoryUnit(`  ${unit}  `), unit);

  assert.equal(canonicalizeSetupInventoryUnit(accentedUnit), accentedUnit);
  assert.equal(normalizeCanonicalSetupInventoryUnit(accentedUnit), accentedUnit);

  assert.equal(SETUP_INVENTORY_UNIT_DEFAULT, "unit");
  assert.equal(
    normalizeCanonicalSetupInventoryUnit(null) ?? SETUP_INVENTORY_UNIT_DEFAULT,
    SETUP_INVENTORY_UNIT_DEFAULT
  );
  assert.equal(
    normalizeCanonicalSetupInventoryUnit("   ") ?? SETUP_INVENTORY_UNIT_DEFAULT,
    SETUP_INVENTORY_UNIT_DEFAULT
  );
});

test("Unicode em-space / NBSP padding cannot invent clean setup inventory units", () => {
  const padded = `${em}${unit}${em}`;
  const nbspUnit = `${nbsp}${unit}${nbsp}`;
  const internalEm = `fl${em}oz`;
  const internalNbsp = `fl${nbsp}oz`;

  // Inventing proof: Unicode trim would invent the clean unit (and soft empty
  // would invent the intentional default).
  assert.equal(padded.trim(), unit);
  assert.equal(nbspUnit.trim(), unit);
  assert.equal(padded.trim() || SETUP_INVENTORY_UNIT_DEFAULT, unit);
  assert.equal(em.trim() || SETUP_INVENTORY_UNIT_DEFAULT, SETUP_INVENTORY_UNIT_DEFAULT);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSetupInventoryUnitToken(padded), padded);
  assert.equal(canonicalizeSetupInventoryUnitToken(padded), null);
  assert.equal(canonicalizeSetupInventoryUnitToken(nbspUnit), null);
  assert.equal(canonicalizeSetupInventoryUnit(padded), null);
  assert.equal(canonicalizeSetupInventoryUnit(nbspUnit), null);

  assert.throws(
    () => normalizeCanonicalSetupInventoryUnit(padded),
    /Setup inventory unit is invalid\./
  );
  assert.throws(
    () => requireCanonicalSetupInventoryUnit(nbspUnit),
    /Setup inventory unit is invalid\./
  );

  // Soft empty still falls through to the prior default without inventing from a padded token.
  assert.equal(
    normalizeCanonicalSetupInventoryUnit(`${em}${em}`) ?? SETUP_INVENTORY_UNIT_DEFAULT,
    SETUP_INVENTORY_UNIT_DEFAULT
  );
  assert.equal(
    normalizeCanonicalSetupInventoryUnit(`${nbsp}`) ?? SETUP_INVENTORY_UNIT_DEFAULT,
    SETUP_INVENTORY_UNIT_DEFAULT
  );

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSetupInventoryUnitToken(internalEm), internalEm);
  assert.equal(canonicalizeSetupInventoryUnit(internalNbsp), internalNbsp);
  assert.equal(normalizeCanonicalSetupInventoryUnit(internalEm), internalEm);
});

test("soft empty stays null without inventing text; controls and non-strings fail closed", () => {
  assert.equal(normalizeCanonicalSetupInventoryUnit(undefined), null);
  assert.equal(normalizeCanonicalSetupInventoryUnit(""), null);
  assert.equal(normalizeCanonicalSetupInventoryUnit("   "), null);
  assert.equal(normalizeCanonicalSetupInventoryUnit(`${em}${em}`), null);
  assert.equal(normalizeCanonicalSetupInventoryUnit(`${nbsp}`), null);
  assert.equal(canonicalizeSetupInventoryUnit(`${em}${em}`), null);

  assert.throws(
    () => requireCanonicalSetupInventoryUnit(`${em}${em}`),
    /Setup inventory unit is invalid\./
  );
  assert.throws(
    () => normalizeCanonicalSetupInventoryUnit(123),
    /Setup inventory unit is invalid\./
  );
  assert.throws(
    () => normalizeCanonicalSetupInventoryUnit(`\u0001${unit}`),
    /Setup inventory unit is invalid\./
  );
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeCanonicalSetupInventoryUnit(`${unit}\t`), unit);
  assert.throws(
    () => normalizeCanonicalSetupInventoryUnit(`${unit}\u0007`),
    /Setup inventory unit is invalid\./
  );
});

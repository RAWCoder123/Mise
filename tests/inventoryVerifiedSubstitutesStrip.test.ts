import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { presentInventoryVerifiedSubstituteRows } from "../services/presentation/ingredientSubstitutionPresentation";
import type { IngredientSubstitutionListItem } from "../services/domain/ingredientSubstitutions";

const base: IngredientSubstitutionListItem = {
  id: "sub-1",
  restaurantId: "rest-1",
  sourceInventoryItemId: "item-a",
  substituteInventoryItemId: "item-b",
  sourceQuantity: 1,
  substituteQuantity: 1.5,
  canonicalUnit: "g",
  verificationStatus: "verified",
  effectiveFrom: "2026-09-01T00:00:00.000Z",
  effectiveTo: null,
  verifiedAt: "2026-09-01T00:00:00.000Z",
  verifiedBy: "user-1",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  sourceItemName: "Rice",
  substituteItemName: "Pancake mix"
};

test("presentInventoryVerifiedSubstituteRows keeps only active verified source matches", () => {
  const rows = presentInventoryVerifiedSubstituteRows(
    [
      base,
      {
        ...base,
        id: "sub-draft",
        verificationStatus: "draft",
        substituteItemName: "Draft mix"
      },
      {
        ...base,
        id: "sub-other",
        sourceInventoryItemId: "item-z",
        substituteItemName: "Other"
      },
      {
        ...base,
        id: "sub-2",
        substituteInventoryItemId: "item-c",
        substituteItemName: "Lettuce",
        substituteQuantity: 2
      }
    ],
    "item-a"
  );

  assert.deepEqual(
    rows.map((row) => row.id),
    ["sub-2", "sub-1"]
  );
  assert.equal(rows[0]?.substituteItemName, "Lettuce");
  assert.equal(rows[1]?.ratioLabel, "1 g → 1.5 g");
});

test("inventory detail surfaces verified substitutes as read-only advisory strip", () => {
  const source = readFileSync("app/inventory/[id].tsx", "utf8");
  assert.match(source, /listVerifiedSubstitutesForInventoryItem/);
  assert.match(source, /presentInventoryVerifiedSubstituteRows/);
  assert.match(source, /inventory\.detail\.substitutes\.title/);
  assert.match(source, /router\.push\("\/settings\/substitutions"\)/);
  assert.doesNotMatch(source, /upsertIngredientSubstitution|verifyIngredientSubstitution/);
  assert.match(
    source,
    /listVerifiedSubstitutesForInventoryItem\([\s\S]*?\.catch\(\s*\(\)\s*=>\s*\[\]/
  );
  assert.match(
    source,
    /entry\.restaurantId === restaurantId && entry\.sourceInventoryItemId === itemId/
  );
});

test("inventory substitute strip catalog keys exist in EN, ES, and zh-Hans", () => {
  const catalog = readFileSync("i18n/catalog.ts", "utf8");
  for (const key of [
    "inventory.detail.substitutes.title",
    "inventory.detail.substitutes.body",
    "inventory.detail.substitutes.manage",
    "inventory.detail.substitutes.manageHint"
  ]) {
    const matches = catalog.match(new RegExp(`"${key.replace(/\./g, "\\.")}"`, "g")) ?? [];
    assert.equal(matches.length, 3, `${key} should appear once per locale`);
  }
});

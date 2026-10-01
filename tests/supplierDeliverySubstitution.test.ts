import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyDeliveryLineSubstitutions,
  buildDeliveryReceivePreview,
  isEligibleDeliverySubstitute,
  listEligibleDeliverySubstitutes,
  receiptInventoryItemIdForDeliveryLine
} from "../services/domain/supplierDelivery";
import type { InventoryItem, PurchaseRecommendation, SupplierOrder } from "../types/mise";
import type { SupplierDeliveryLineInput } from "../services/repositories/repositoryContracts";

const RESTAURANT_ID = "rest-1";

function item(overrides: Partial<InventoryItem> & Pick<InventoryItem, "id" | "item_name">): InventoryItem {
  return {
    restaurant_id: RESTAURANT_ID,
    category: "Produce",
    unit: "lb",
    current_quantity: 10,
    par_level: 20,
    reorder_threshold: 5,
    estimated_unit_cost: 2,
    supplier_id: "sup-1",
    supplier_name: "Sysco",
    last_updated: "2026-08-31T00:00:00.000Z",
    canonical_unit: "g",
    canonical_quantity_per_unit: 453.59237,
    canonical_unit_verification_status: "verified",
    ...overrides
  };
}

describe("supplier delivery substitutions", () => {
  it("lists only verified same-unit substitutes in the same restaurant", () => {
    const ordered = item({ id: "item-a", item_name: "Roma tomatoes" });
    const eligible = item({ id: "item-b", item_name: "Cherry tomatoes" });
    const wrongUnit = item({
      id: "item-c",
      item_name: "Olive oil",
      canonical_unit: "ml",
      unit: "l"
    });
    const unverified = item({
      id: "item-d",
      item_name: "Heirloom tomatoes",
      canonical_unit_verification_status: "draft"
    });
    const otherTenant = item({
      id: "item-e",
      item_name: "Other tomatoes",
      restaurant_id: "rest-2"
    });

    assert.equal(isEligibleDeliverySubstitute(ordered, eligible), true);
    assert.equal(isEligibleDeliverySubstitute(ordered, wrongUnit), false);
    assert.equal(isEligibleDeliverySubstitute(ordered, unverified), false);
    assert.equal(isEligibleDeliverySubstitute(ordered, otherTenant), false);
    assert.equal(isEligibleDeliverySubstitute(ordered, ordered), false);

    const listed = listEligibleDeliverySubstitutes(ordered, [
      ordered,
      eligible,
      wrongUnit,
      unverified,
      otherTenant
    ]);
    assert.deepEqual(
      listed.map((entry) => entry.id),
      ["item-b"]
    );
  });

  it("applies substitutions fail-closed and credits the substitute receipt id", () => {
    const ordered = item({ id: "item-a", item_name: "Roma tomatoes" });
    const substitute = item({ id: "item-b", item_name: "Cherry tomatoes" });
    const line: SupplierDeliveryLineInput = {
      inventoryItemId: ordered.id,
      orderedQuantity: 10,
      receivedQuantity: 10,
      damagedQuantity: 0,
      missingQuantity: 0,
      canonicalUnit: "g",
      substitutionInventoryItemId: null,
      unitPrice: null,
      discrepancyReason: null
    };

    const applied = applyDeliveryLineSubstitutions(
      [line],
      { [ordered.id]: substitute.id },
      [ordered, substitute]
    );
    assert.equal(applied[0]!.substitutionInventoryItemId, substitute.id);
    assert.equal(receiptInventoryItemIdForDeliveryLine(applied[0]!), substitute.id);

    const cleared = applyDeliveryLineSubstitutions(
      applied,
      { [ordered.id]: null },
      [ordered, substitute]
    );
    assert.equal(cleared[0]!.substitutionInventoryItemId, null);
    assert.equal(receiptInventoryItemIdForDeliveryLine(cleared[0]!), ordered.id);

    assert.throws(
      () =>
        applyDeliveryLineSubstitutions(
          [line],
          { "unknown-item": substitute.id },
          [ordered, substitute]
        ),
      /unknown ordered line/i
    );
    assert.throws(
      () =>
        applyDeliveryLineSubstitutions(
          [line],
          { [ordered.id]: "missing-item" },
          [ordered, substitute]
        ),
      /not verified/i
    );
  });

  it("builds a receive preview with eligible substitutes for ordered lines", () => {
    const ordered = item({ id: "item-a", item_name: "Roma tomatoes" });
    const substitute = item({ id: "item-b", item_name: "Cherry tomatoes" });
    const order: SupplierOrder = {
      id: "order-1",
      restaurant_id: RESTAURANT_ID,
      supplier_id: "sup-1",
      supplier_name: "Sysco",
      order_message: "Please deliver Roma tomatoes.",
      status: "sent",
      delivery_date: "2026-08-31",
      operator_note: null,
      created_at: "2026-08-30T12:00:00.000Z"
    };
    const recommendation: PurchaseRecommendation = {
      id: "rec-1",
      restaurant_id: RESTAURANT_ID,
      inventory_item_id: ordered.id,
      item_name: ordered.item_name,
      supplier_id: "sup-1",
      supplier_name: "Sysco",
      recommended_quantity: 12,
      unit: "lb",
      reason: "Low coverage",
      urgency: "high",
      status: "ordered",
      supplier_order_id: order.id,
      created_at: order.created_at
    };

    const preview = buildDeliveryReceivePreview({
      order,
      recommendations: [recommendation],
      inventoryItems: [ordered, substitute],
      requireVerifiedCanonicalUnit: true
    });

    assert.equal(preview.lines.length, 1);
    assert.equal(preview.lines[0]!.inventoryItemId, ordered.id);
    assert.equal(preview.lines[0]!.orderedQuantity, 12);
    assert.deepEqual(
      preview.lines[0]!.eligibleSubstitutes.map((entry) => entry.id),
      [substitute.id]
    );
  });
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeOptionalDocumentReference } from "../services/domain/supplierDelivery";
import { SUPPLIER_DELIVERY_DOCUMENT_REFERENCE_MAX_CHARACTERS } from "../services/domain/securityLimits";
import { buildSupplierOrderDeliveryEvidence } from "../services/domain/supplierReliability";
import type { SupplierOrder } from "../types/mise";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260903220000_supplier_delivery_document_reference.sql",
    import.meta.url
  ),
  "utf8"
);

test("normalizeOptionalDocumentReference trims, nulls empty, and bounds length", () => {
  assert.equal(normalizeOptionalDocumentReference(null), null);
  assert.equal(normalizeOptionalDocumentReference("  "), null);
  assert.equal(normalizeOptionalDocumentReference(" INV-42 "), "INV-42");
  assert.throws(
    () => normalizeOptionalDocumentReference("x".repeat(SUPPLIER_DELIVERY_DOCUMENT_REFERENCE_MAX_CHARACTERS + 1)),
    /80 characters or fewer/
  );
});

test("delivery evidence surfaces document_reference separately from notes", () => {
  const order: SupplierOrder = {
    id: "order-1",
    restaurant_id: "restaurant-a",
    supplier_id: "00000000-0000-4000-8000-000000000401",
    supplier_name: "Pantry Co.",
    order_message: "Order",
    operator_note: null,
    status: "completed",
    delivery_date: "2026-09-01",
    created_at: "2026-08-30T12:00:00.000Z"
  };
  const evidence = buildSupplierOrderDeliveryEvidence({
    restaurantId: "restaurant-a",
    restaurantTimeZone: "America/New_York",
    order,
    deliveries: [
      {
        id: "delivery-1",
        restaurant_id: "restaurant-a",
        supplier_order_id: "order-1",
        status: "received",
        received_at: "2026-09-01T15:00:00.000Z",
        notes: "Boxes were cold.",
        document_reference: "PO-7781",
        created_at: "2026-09-01T15:00:00.000Z"
      }
    ],
    items: [
      {
        id: "line-1",
        restaurant_id: "restaurant-a",
        delivery_id: "delivery-1",
        inventory_item_id: "item-1",
        ordered_quantity: 10,
        received_quantity: 10,
        damaged_quantity: 0,
        missing_quantity: 0,
        canonical_unit: "each"
      }
    ]
  });
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0]?.documentReference, "PO-7781");
  assert.equal(evidence[0]?.notes, "Boxes were cold.");
});

test("additive migration adds bounded document_reference and wraps record_supplier_delivery", () => {
  assert.match(migration, /add column if not exists document_reference text/i);
  assert.match(
    migration,
    /supplier_deliveries_document_reference_bound_check[\s\S]*length\(trim\(document_reference\)\) between 1 and 80/i
  );
  assert.match(
    migration,
    /rename to record_supplier_delivery_pre_document_reference/i
  );
  assert.match(
    migration,
    /p_document_reference text default null/i
  );
  assert.match(migration, /auth\.uid\(\)\s+is null/i);
  assert.match(
    migration,
    /private\.has_restaurant_role\(\s*p_restaurant_id,\s*array\['owner',\s*'admin',\s*'manager'\]/i
  );
  assert.match(
    migration,
    /grant execute on function public\.record_supplier_delivery\(\s*uuid, uuid, text, timestamptz, jsonb, numeric, text, text\s*\)\s*to authenticated/i
  );
  assert.doesNotMatch(
    migration,
    /grant\s+(insert|update|delete)[\s\S]*supplier_deliveries[\s\S]*to\s+authenticated/i
  );
  assert.doesNotMatch(
    migration,
    /source_reference\s*=\s*document_reference/i
  );
});

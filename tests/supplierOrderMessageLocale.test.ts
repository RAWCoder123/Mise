import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildSupplierOrderMessage,
  supplierOrderMessageLocaleFor
} from "../services/domain/miseDomain";
import {
  formatSupplierOrderMessageBody,
  formatSupplierOrderSubject,
  resolveSupplierOrderMessageLocale,
  SUPPLIER_ORDER_MESSAGE_LOCALES
} from "../services/domain/supplierOrderMessageTemplates";
import type { PurchaseRecommendation } from "../types/mise";

const recommendation = {
  id: "30000000-0000-4000-8000-000000000001",
  restaurant_id: "10000000-0000-4000-8000-000000000001",
  inventory_item_id: "40000000-0000-4000-8000-000000000001",
  item_name: "Tomatoes",
  supplier_id: "50000000-0000-4000-8000-000000000001",
  supplier_name: "Local Produce Co.",
  recommended_quantity: 4,
  unit: "each",
  status: "approved",
  supplier_order_id: "20000000-0000-4000-8000-000000000001",
  reason: "test",
  created_at: "2026-08-30T00:00:00.000Z"
} as PurchaseRecommendation;

test("supplier order message locales resolve only the allowlisted values", () => {
  assert.equal(resolveSupplierOrderMessageLocale("es"), "es");
  assert.equal(resolveSupplierOrderMessageLocale("zh-Hans"), "zh-Hans");
  assert.equal(resolveSupplierOrderMessageLocale("fr"), "en");
  assert.equal(resolveSupplierOrderMessageLocale(null), "en");
  assert.deepEqual([...SUPPLIER_ORDER_MESSAGE_LOCALES], ["en", "es", "zh-Hans"]);
});

test("supplier order subjects stay locale-specific without control characters", () => {
  assert.equal(
    formatSupplierOrderSubject("Mise Cafe", "Local Produce Co.", "en"),
    "Mise Cafe order for Local Produce Co."
  );
  assert.equal(
    formatSupplierOrderSubject("Mise Cafe", "Local Produce Co.", "es"),
    "Pedido de Mise Cafe para Local Produce Co."
  );
  assert.equal(
    formatSupplierOrderSubject("Mise Cafe", "Local Produce Co.", "zh-Hans"),
    "Mise Cafe 发给 Local Produce Co. 的订单"
  );
});

test("supplier order bodies localize labels while preserving line payloads", () => {
  const lines = "Tomatoes - 4 each";
  assert.equal(
    formatSupplierOrderMessageBody({
      supplierName: "Local Produce Co.",
      linesBody: lines,
      operatorNote: "Side entrance",
      locale: "en"
    }),
    "Order draft for Local Produce Co.\n\nTomatoes - 4 each\n\nDelivery requested: Tomorrow morning\n\nNotes:\nSide entrance"
  );
  assert.equal(
    formatSupplierOrderMessageBody({
      supplierName: "Local Produce Co.",
      linesBody: lines,
      operatorNote: "Entrada lateral",
      locale: "es"
    }),
    "Borrador de pedido para Local Produce Co.\n\nTomatoes - 4 each\n\nEntrega solicitada: Mañana por la mañana\n\nNotas:\nEntrada lateral"
  );
  assert.equal(
    formatSupplierOrderMessageBody({
      supplierName: "Local Produce Co.",
      linesBody: lines,
      operatorNote: "侧门",
      locale: "zh-Hans"
    }),
    "Local Produce Co. 的订单草稿\n\nTomatoes - 4 each\n\n请求送达：明天上午\n\n备注：\n侧门"
  );
});

test("buildSupplierOrderMessage freezes the selected locale into the body", () => {
  assert.match(
    buildSupplierOrderMessage("Local Produce Co.", [recommendation], null, "es"),
    /^Borrador de pedido para Local Produce Co\./
  );
  assert.match(
    buildSupplierOrderMessage("Local Produce Co.", [recommendation], "note", "zh-Hans"),
    /备注：\nnote$/
  );
  assert.equal(supplierOrderMessageLocaleFor({ message_locale: "es" }), "es");
});

test("localized supplier draft headers are not parsed as line items", async () => {
  const { parseSupplierOrderLines } = await import("../utils/orderPresentation");
  const es = parseSupplierOrderLines(
    "Borrador de pedido para Local Produce Co.\n\nTomatoes - 4 each\n\nEntrega solicitada: Mañana por la mañana\n\nNotas:\nSide"
  );
  assert.deepEqual(es.map((line) => line.itemName), ["Tomatoes"]);
  const zh = parseSupplierOrderLines(
    "Local Produce Co. 的订单草稿\n\nTomatoes - 4 each\n\n请求送达：明天上午\n\n备注：\nSide"
  );
  assert.deepEqual(zh.map((line) => line.itemName), ["Tomatoes"]);
});

test("hosted migration mirrors the TypeScript supplier-send locale templates", () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260830040000_supplier_send_locale_templates.sql"
    ),
    "utf8"
  );
  assert.match(migration, /message_locale text/);
  assert.match(migration, /supplier_orders_message_locale_allowlist_check/);
  assert.match(migration, /Borrador de pedido para/);
  assert.match(migration, /Entrega solicitada: Mañana por la mañana/);
  assert.match(migration, /的订单草稿/);
  assert.match(migration, /请求送达：明天上午/);
  assert.match(migration, /Pedido de /);
  assert.match(migration, /发给 /);
  assert.match(migration, /private\.format_supplier_order_message_body/);
  assert.match(migration, /private\.format_supplier_order_subject/);
  assert.match(migration, /private\.actor_supplier_message_locale/);
  assert.match(migration, /supplier_orders_set_message_locale/);
  assert.doesNotMatch(migration, /grant execute on function private\.format_supplier_order/);
});

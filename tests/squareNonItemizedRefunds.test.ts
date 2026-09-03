import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { readNonItemizedSquareRefundAttention } from "../services/domain/squareNonItemizedRefunds";
import {
  classifyNonItemizedSquareRefund,
  normalizeOrderSales,
  summarizeNonItemizedSquareRefunds,
} from "../supabase/functions/_shared/square.ts";

const migration = readFileSync(
  "supabase/migrations/20260903010000_square_non_itemized_refund_attention.sql",
  "utf8",
);
const syncPos = readFileSync("supabase/functions/sync-pos-sales/index.ts", "utf8");
const webhooks = readFileSync("supabase/functions/square-webhooks/index.ts", "utf8");

test("cash-only Square refunds classify without inventing sale rows", () => {
  const order = {
    id: "order-cash-1",
    location_id: "loc-a",
    closed_at: "2026-09-02T15:30:00.000Z",
    line_items: [
      {
        uid: "line-1",
        name: "Burger",
        quantity: "1",
        gross_sales_money: { amount: 1200 },
        total_money: { amount: 1200 },
      },
    ],
    refunds: [
      {
        id: "refund-1",
        status: "COMPLETED",
        amount_money: { amount: 1200, currency: "USD" },
      },
    ],
    returns: [],
  };

  const sales = normalizeOrderSales(order);
  assert.equal(sales.length, 1);
  assert.equal(sales[0]?.quantity_sold, 1);

  const diagnostic = classifyNonItemizedSquareRefund(order);
  assert.ok(diagnostic);
  assert.equal(diagnostic?.orderId, "order-cash-1");
  assert.equal(diagnostic?.refundAmount, 12);
  assert.equal(diagnostic?.reason, "non_itemized_or_cash_refund");
});

test("itemized return lines are not treated as cash-only refunds", () => {
  const order = {
    id: "order-return-1",
    closed_at: "2026-09-02T16:00:00.000Z",
    returns: [
      {
        uid: "ret-1",
        return_line_items: [
          {
            uid: "rline-1",
            name: "Burger",
            quantity: "1",
            total_money: { amount: 1200 },
          },
        ],
        return_amounts: { total_money: { amount: 1200 } },
      },
    ],
    return_amounts: { total_money: { amount: 1200 } },
  };

  assert.equal(classifyNonItemizedSquareRefund(order), null);
});

test("zero-dollar comps without refund money stay silent", () => {
  const order = {
    id: "order-comp-1",
    closed_at: "2026-09-02T17:00:00.000Z",
    line_items: [
      {
        uid: "line-1",
        name: "Comp drink",
        quantity: "1",
        gross_sales_money: { amount: 0 },
        total_money: { amount: 0 },
      },
    ],
    net_amounts: { total_money: { amount: 0 } },
  };

  assert.equal(classifyNonItemizedSquareRefund(order), null);
});

test("refund summary bounds sample order ids", () => {
  const summary = summarizeNonItemizedSquareRefunds(
    Array.from({ length: 8 }, (_, index) => ({
      orderId: `order-${index + 1}`,
      saleDate: "2026-09-02",
      refundAmount: 3.5,
      reason: "non_itemized_or_cash_refund" as const,
    })),
  );
  assert.equal(summary.orderCount, 8);
  assert.equal(summary.sampleOrderIds.length, 5);
  assert.equal(summary.refundAmountTotal, 28);
});

test("settings reader fails closed on malformed attention payloads", () => {
  assert.equal(readNonItemizedSquareRefundAttention(null), null);
  assert.equal(readNonItemizedSquareRefundAttention({}), null);
  assert.equal(
    readNonItemizedSquareRefundAttention({
      nonItemizedRefundAttention: {
        orderCount: 0,
        refundAmountTotal: 12,
        sampleOrderIds: ["a"],
        detectedAt: "2026-09-02T00:00:00.000Z",
        windowFrom: "2026-08-05",
        windowTo: "2026-09-02",
        importId: null,
      },
    }),
    null,
  );

  const attention = readNonItemizedSquareRefundAttention({
    nonItemizedRefundAttention: {
      orderCount: 2,
      refundAmountTotal: 18.25,
      sampleOrderIds: ["order-a", "order-b", 12, "order-c"],
      detectedAt: "2026-09-02T12:00:00.000Z",
      windowFrom: "2026-08-05",
      windowTo: "2026-09-02",
      importId: "import-1",
    },
  });
  assert.ok(attention);
  assert.equal(attention?.orderCount, 2);
  assert.equal(attention?.refundAmountTotal, 18.25);
  assert.deepEqual(attention?.sampleOrderIds, ["order-a", "order-b", "order-c"]);
  assert.equal(attention?.importId, "import-1");
});

test("sync and webhook paths persist cash-refund attention through the additive RPC", () => {
  assert.match(syncPos, /searchSquareOrdersDetailed/i);
  assert.match(syncPos, /service_record_square_non_itemized_refund_attention/i);
  assert.match(syncPos, /nonItemizedRefundOrderCount/i);
  assert.match(webhooks, /searchSquareOrdersDetailed/i);
  assert.match(webhooks, /service_record_square_non_itemized_refund_attention/i);
  assert.match(migration, /create or replace function private\.service_record_square_non_itemized_refund_attention/i);
  assert.match(migration, /nonItemizedRefundAttention/i);
  assert.match(migration, /grant execute on function public\.service_record_square_non_itemized_refund_attention/i);
  assert.match(migration, /to service_role/i);
  assert.doesNotMatch(migration, /grant execute[\s\S]*non_itemized_refund_attention[\s\S]*authenticated/i);
  assert.doesNotMatch(migration, /quantity_sold\s*<\s*0/i);
});

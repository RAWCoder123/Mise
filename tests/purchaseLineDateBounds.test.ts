import assert from "node:assert/strict";
import test from "node:test";

import {
  PURCHASE_LINE_DATE_FUTURE_SKEW_DAYS,
  PURCHASE_LINE_DATE_MAX_LOOKBACK_DAYS,
  assertPurchaseLineCalendarDateInWindow,
  normalizePurchaseLineInputWithClock,
  purchaseLineUtcCalendarDay
} from "../services/domain/purchaseLines";

const NOW = new Date("2026-09-25T12:00:00.000Z");

function shift(isoDay: string, days: number) {
  const shifted = new Date(`${isoDay}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

function base(overrides: Record<string, unknown> = {}) {
  return {
    lineIndex: 0,
    lineType: "purchase" as const,
    rawItemDescription: "Chicken Thighs 40 LB",
    quantity: 1,
    unitOfMeasure: "case",
    unitPrice: 10,
    extendedPrice: 10,
    currency: "USD",
    transactionDate: "2026-09-20",
    parseConfidence: "confirmed" as const,
    ...overrides
  };
}

test("purchase line date window constants match the inventory far-past lookback shape", () => {
  assert.equal(PURCHASE_LINE_DATE_MAX_LOOKBACK_DAYS, 90);
  assert.equal(PURCHASE_LINE_DATE_FUTURE_SKEW_DAYS, 1);
  assert.equal(purchaseLineUtcCalendarDay(NOW), "2026-09-25");
});

test("assertPurchaseLineCalendarDateInWindow accepts today, skew, and lookback boundary", () => {
  const today = purchaseLineUtcCalendarDay(NOW);
  assert.equal(assertPurchaseLineCalendarDateInWindow(today, "transaction_date", NOW), today);
  assert.equal(
    assertPurchaseLineCalendarDateInWindow(shift(today, 1), "transaction_date", NOW),
    shift(today, 1)
  );
  assert.equal(
    assertPurchaseLineCalendarDateInWindow(shift(today, -90), "transaction_date", NOW),
    shift(today, -90)
  );
  assert.equal(
    assertPurchaseLineCalendarDateInWindow(shift(today, -30), "received_date", NOW),
    shift(today, -30)
  );
});

test("assertPurchaseLineCalendarDateInWindow rejects future and far-past dates with exact messages", () => {
  const today = purchaseLineUtcCalendarDay(NOW);
  assert.throws(
    () => assertPurchaseLineCalendarDateInWindow(shift(today, 2), "transaction_date", NOW),
    { message: "Purchase line transaction_date is in the future" }
  );
  assert.throws(
    () => assertPurchaseLineCalendarDateInWindow(shift(today, -91), "transaction_date", NOW),
    { message: "Purchase line transaction_date is older than the allowed lookback window" }
  );
  assert.throws(
    () => assertPurchaseLineCalendarDateInWindow("2099-01-01", "received_date", NOW),
    { message: "Purchase line received_date is in the future" }
  );
  assert.throws(
    () => assertPurchaseLineCalendarDateInWindow("1990-01-01", "received_date", NOW),
    { message: "Purchase line received_date is older than the allowed lookback window" }
  );
});

test("normalizePurchaseLineInputWithClock rejects out-of-window transaction and received dates", () => {
  assert.throws(
    () => normalizePurchaseLineInputWithClock(base({ transactionDate: "2099-06-01" }), NOW),
    { message: "Purchase line transaction_date is in the future" }
  );
  assert.throws(
    () => normalizePurchaseLineInputWithClock(base({ transactionDate: "1990-06-01" }), NOW),
    { message: "Purchase line transaction_date is older than the allowed lookback window" }
  );
  assert.throws(
    () =>
      normalizePurchaseLineInputWithClock(
        base({ transactionDate: "2026-09-20", receivedDate: "2099-06-01" }),
        NOW
      ),
    { message: "Purchase line received_date is in the future" }
  );
  assert.throws(
    () =>
      normalizePurchaseLineInputWithClock(
        base({ transactionDate: "2026-09-20", receivedDate: "1990-06-01" }),
        NOW
      ),
    { message: "Purchase line received_date is older than the allowed lookback window" }
  );
});

test("normalizePurchaseLineInputWithClock accepts boundary dates inside the window", () => {
  const today = purchaseLineUtcCalendarDay(NOW);
  const line = normalizePurchaseLineInputWithClock(
    base({
      transactionDate: shift(today, -90),
      receivedDate: shift(today, 1)
    }),
    NOW
  );
  assert.equal(line.transactionDate, shift(today, -90));
  assert.equal(line.receivedDate, shift(today, 1));
});

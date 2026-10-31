import assert from "node:assert/strict";
import test from "node:test";
import { nextDateKeyInTimeZone, toDateKeyInTimeZone } from "../utils/format";

test("toDateKeyInTimeZone follows a valid restaurant timezone across the UTC boundary", () => {
  const instant = new Date("2026-10-31T22:30:00.000Z");
  assert.equal(toDateKeyInTimeZone(instant, "Asia/Tokyo"), "2026-11-01");
  assert.equal(toDateKeyInTimeZone(instant, "America/Los_Angeles"), "2026-10-31");
  assert.equal(nextDateKeyInTimeZone(instant, "Asia/Tokyo"), "2026-11-02");
});

test("toDateKeyInTimeZone fails closed on missing, invalid, or Unicode-padded timezones", () => {
  const instant = new Date("2026-10-31T22:30:00.000Z");
  const paddedTimeZone = "\u2003America/New_York\u2003";

  // Inventing proof: valid Asia/Tokyo is 2026-11-01. Pre-fix UTC catch/fallback
  // treated invalid and Unicode-padded IANA names as UTC and invented 2026-10-31.
  assert.equal(toDateKeyInTimeZone(instant, "Asia/Tokyo"), "2026-11-01");

  assert.throws(
    () => toDateKeyInTimeZone(instant, paddedTimeZone),
    /Operating date requires a valid restaurant timezone/
  );
  assert.throws(
    () => toDateKeyInTimeZone(instant, "Not/A_Zone"),
    /Operating date requires a valid restaurant timezone/
  );
  assert.throws(
    () => toDateKeyInTimeZone(instant, "Invalid/Timezone"),
    /Operating date requires a valid restaurant timezone/
  );
  assert.throws(
    () => toDateKeyInTimeZone(instant, ""),
    /Operating date requires a restaurant timezone/
  );
  assert.throws(
    () => toDateKeyInTimeZone(instant, "\u2003"),
    /Operating date requires a restaurant timezone/
  );
  assert.throws(
    () => nextDateKeyInTimeZone(instant, paddedTimeZone),
    /Operating date requires a valid restaurant timezone/
  );
});

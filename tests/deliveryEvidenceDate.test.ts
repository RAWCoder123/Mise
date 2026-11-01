import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { restaurantTimeZoneForDeliveryEvidence } from "../services/domain/deliveryEvidenceDate";

const timeZone = "America/New_York";
const receivedAt = "2026-07-20T01:00:00.000Z";

test("orders delivery-evidence UTC inventing is proven and fail-closed", () => {
  // At 2026-07-20T01:00:00.000Z America/New_York is still Jul 19. The previous
  // Orders detail path `restaurant?.timezone ?? "UTC"` invented Jul 20 whenever
  // the restaurant timezone was missing.
  const nyc = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone
  }).format(new Date(receivedAt));
  const missingTimezone = null as string | null;
  const previousInvent = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: missingTimezone ?? "UTC"
  }).format(new Date(receivedAt));

  assert.equal(nyc, "Jul 19, 2026");
  assert.equal(previousInvent, "Jul 20, 2026");
  assert.notEqual(nyc, previousInvent);

  assert.equal(restaurantTimeZoneForDeliveryEvidence(timeZone), timeZone);

  const padded = `\u2003${timeZone}\u2003`;
  assert.equal(padded.trim(), timeZone);
  assert.throws(
    () => restaurantTimeZoneForDeliveryEvidence(padded),
    /Delivery evidence date requires a valid restaurant timezone/
  );
  assert.throws(
    () => restaurantTimeZoneForDeliveryEvidence("\u2003"),
    /Delivery evidence date requires a restaurant timezone/
  );
  assert.throws(
    () => restaurantTimeZoneForDeliveryEvidence(""),
    /Delivery evidence date requires a restaurant timezone/
  );
  assert.throws(
    () => restaurantTimeZoneForDeliveryEvidence(null),
    /Delivery evidence date requires a restaurant timezone/
  );
  assert.throws(
    () => restaurantTimeZoneForDeliveryEvidence(undefined),
    /Delivery evidence date requires a restaurant timezone/
  );
  assert.throws(
    () => restaurantTimeZoneForDeliveryEvidence("Not/A_Real_Zone"),
    /Delivery evidence date requires a valid restaurant timezone/
  );
});

test("orders detail no longer invents UTC for delivery-evidence dates", () => {
  const detail = readFileSync("app/orders/[id].tsx", "utf8");
  const domain = readFileSync("services/domain/deliveryEvidenceDate.ts", "utf8");

  assert.match(detail, /restaurantTimeZoneForDeliveryEvidence/);
  assert.match(detail, /formatDeliveryEvidenceReceivedDate/);
  assert.doesNotMatch(
    detail,
    /deliveryEvidence\.meta[\s\S]{0,220}timeZone:\s*restaurant\?\.timezone\s*\?\?\s*"UTC"/
  );
  assert.match(domain, /Do not Unicode-trim into a clean IANA identity/);
});

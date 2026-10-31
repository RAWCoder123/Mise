import assert from "node:assert/strict";
import test from "node:test";

import { greetingPeriodForNow } from "../services/domain/homeGreeting";

const timeZone = "America/New_York";

test("home greeting uses restaurant-local hour boundaries", () => {
  // 15:30Z is 11:30 EDT → morning; 16:30Z is 12:30 EDT → afternoon;
  // 21:30Z is 17:30 EDT → evening.
  assert.equal(
    greetingPeriodForNow(timeZone, new Date("2026-07-19T15:30:00.000Z")),
    "morning"
  );
  assert.equal(
    greetingPeriodForNow(timeZone, new Date("2026-07-19T16:30:00.000Z")),
    "afternoon"
  );
  assert.equal(
    greetingPeriodForNow(timeZone, new Date("2026-07-19T21:30:00.000Z")),
    "evening"
  );
});

test("home greeting fails closed on Unicode-padded or invalid restaurant timezones", () => {
  // Em-space padding stays truthy through the emptiness gate. Without Intl
  // validation, hourInTimeZone would silently fall back to UTC and invent
  // afternoon instead of morning for this instant (NY local 11, UTC 15).
  const padded = `\u2003${timeZone}\u2003`;
  assert.equal(padded.trim(), timeZone);

  const inventingInstant = new Date("2026-07-19T15:30:00.000Z");
  assert.equal(greetingPeriodForNow(timeZone, inventingInstant), "morning");

  assert.throws(
    () => greetingPeriodForNow(padded, inventingInstant),
    /valid restaurant timezone/i
  );
  assert.throws(() => greetingPeriodForNow("\u2003", inventingInstant), /timezone/i);
  assert.throws(
    () => greetingPeriodForNow("Not/A_Real_Zone", inventingInstant),
    /valid restaurant timezone/i
  );
  assert.throws(() => greetingPeriodForNow("", inventingInstant), /timezone/i);
});

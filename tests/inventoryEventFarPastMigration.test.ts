import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  INVENTORY_EVENT_EFFECTIVE_AT_MAX_LOOKBACK_DAYS,
  INVENTORY_EVENT_EFFECTIVE_AT_MAX_LOOKBACK_MS
} from "../services/domain/securityLimits";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260903160000_reject_far_past_inventory_events.sql",
    import.meta.url
  ),
  "utf8"
);

const foundation = readFileSync(
  new URL(
    "../supabase/migrations/20260726195018_operational_data_foundation_inventory_ledger.sql",
    import.meta.url
  ),
  "utf8"
);

const futureCountGuard = readFileSync(
  new URL(
    "../supabase/migrations/20260818120000_reject_future_dated_inventory_counts.sql",
    import.meta.url
  ),
  "utf8"
);

const pgTap = readFileSync(
  new URL("../supabase/tests/database/inventory_event_far_past.test.sql", import.meta.url),
  "utf8"
);

test("additive migration rejects far-past inventory_events effective_at", () => {
  assert.equal(INVENTORY_EVENT_EFFECTIVE_AT_MAX_LOOKBACK_DAYS, 90);
  assert.equal(
    INVENTORY_EVENT_EFFECTIVE_AT_MAX_LOOKBACK_MS,
    90 * 24 * 60 * 60 * 1000
  );
  assert.match(
    migration,
    /create\s+or\s+replace\s+function\s+private\.reject_far_past_inventory_event/i
  );
  assert.match(migration, /security\s+invoker[\s\S]*set\s+search_path\s*=\s*''/i);
  assert.match(
    migration,
    /new\.effective_at\s*<\s*clock_timestamp\(\)\s*-\s*interval\s*'90 days'/i
  );
  assert.match(
    migration,
    /Inventory ledger events cannot be effective more than 90 days in the past/i
  );
  assert.match(
    migration,
    /create trigger reject_far_past_inventory_event[\s\S]*before insert on public\.inventory_events/i
  );
  assert.doesNotMatch(
    migration,
    /grant\s+(insert|update|delete)[\s\S]*inventory_events[\s\S]*to\s+authenticated/i
  );
  assert.doesNotMatch(
    migration,
    /create\s+or\s+replace\s+function\s+public\.record_inventory_event/i
  );
});

test("foundation and future-count guard historically left far-past effective_at open", () => {
  assert.match(
    foundation,
    /if p_effective_at is null[\s\S]*raise exception 'Inventory event evidence is incomplete'/i
  );
  assert.doesNotMatch(foundation, /reject_far_past_inventory_event/i);
  assert.doesNotMatch(foundation, /90 days in the past/i);
  assert.doesNotMatch(futureCountGuard, /90 days/i);
  assert.doesNotMatch(futureCountGuard, /reject_far_past_inventory_event/i);
});

test("dedicated pgTAP proves far-past ledger effective_at fails closed", () => {
  assert.match(pgTap, /select plan\(6\)/);
  assert.match(pgTap, /far-past-receipt-1/);
  assert.match(pgTap, /far-past-waste-1/);
  assert.match(pgTap, /far-past-count-1/);
  assert.match(pgTap, /now\(\)\s*-\s*interval\s*'91 days'/i);
  assert.match(
    pgTap,
    /Inventory ledger events cannot be effective more than 90 days in the past/
  );
});

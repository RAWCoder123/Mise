import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PURCHASE_LINE_DATE_FUTURE_SKEW_DAYS,
  PURCHASE_LINE_DATE_MAX_LOOKBACK_DAYS
} from "../services/domain/purchaseLines";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260925120000_reject_out_of_window_purchase_line_dates.sql",
    import.meta.url
  ),
  "utf8"
);

test("purchase line date bounds migration is trigger-only and does not redeclare ingest", () => {
  assert.match(migration, /create or replace function private\.reject_out_of_window_purchase_line_dates\(\)/);
  assert.match(
    migration,
    /before insert on public\.purchase_lines\nfor each row execute function private\.reject_out_of_window_purchase_line_dates\(\)/
  );
  assert.doesNotMatch(migration, /create or replace function public\.ingest_purchase_lines/i);
  assert.doesNotMatch(migration, /create or replace function private\.append_purchase_line/i);
  assert.match(
    migration,
    /revoke all on function private\.reject_out_of_window_purchase_line_dates\(\) from public, anon, authenticated, service_role/
  );
});

test("SQL lookback and future-skew constants stay locked to the domain exports", () => {
  assert.match(
    migration,
    new RegExp(`max_lookback_days constant integer := ${PURCHASE_LINE_DATE_MAX_LOOKBACK_DAYS};`)
  );
  assert.match(
    migration,
    new RegExp(`future_skew_days constant integer := ${PURCHASE_LINE_DATE_FUTURE_SKEW_DAYS};`)
  );
  assert.match(migration, /Purchase line transaction_date is in the future/);
  assert.match(
    migration,
    /Purchase line transaction_date is older than the allowed lookback window/
  );
  assert.match(migration, /Purchase line received_date is in the future/);
  assert.match(
    migration,
    /Purchase line received_date is older than the allowed lookback window/
  );
});

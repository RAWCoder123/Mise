import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { RECALCULATION_MAX_ATTEMPTS } from "../services/domain/recalculationSchedule";

const migration = readFileSync(
  new URL("../supabase/migrations/20260805120000_recalculation_run_ledger.sql", import.meta.url),
  "utf8"
);

const pgTap = readFileSync(
  new URL("../supabase/tests/database/recalculation_run_ledger.test.sql", import.meta.url),
  "utf8"
);

const recordFunctionSignature =
  /public\.record_recalculation_run\(\s*uuid, text, date, text, smallint, text, text, timestamptz, timestamptz,\s*integer, boolean, text, text, text\s*\)/i;

test("the run ledger is tenant-scoped, append-only, and readable but not writable by members", () => {
  assert.match(migration, /create table if not exists public\.recalculation_runs/i);
  assert.match(
    migration,
    /restaurant_id uuid not null references public\.restaurants\(id\) on delete cascade/i
  );
  assert.match(migration, /alter table public\.recalculation_runs enable row level security/i);
  assert.match(
    migration,
    /create policy "Members can view recalculation runs"[\s\S]*for select[\s\S]*using \(private\.is_restaurant_member\(restaurant_id\)\)/i
  );
  assert.match(migration, /unique \(restaurant_id, id\)/i);
  assert.match(migration, /unique \(restaurant_id, idempotency_key\)/i);

  // Members read; every write goes through the RPC.
  assert.match(migration, /grant select on public\.recalculation_runs to authenticated;/i);
  assert.doesNotMatch(
    migration,
    /grant[^;]*\b(insert|update|delete)\b[^;]*on public\.recalculation_runs[^;]*to[^;]*authenticated/i
  );

  // Both guard triggers: the global pause switch and the append-only guard.
  assert.match(
    migration,
    /create trigger enforce_authenticated_operational_mode[\s\S]*on public\.recalculation_runs/i
  );
  assert.match(
    migration,
    /create trigger reject_recalculation_run_mutation[\s\S]*before update or delete on public\.recalculation_runs[\s\S]*private\.reject_immutable_operational_record_mutation/i
  );
});

test("the record RPC derives authority from auth.uid() and is never granted to service_role", () => {
  assert.match(migration, /create or replace function public\.record_recalculation_run/i);
  assert.match(migration, /actor_user_id uuid := auth\.uid\(\)/i);
  assert.match(migration, /security definer[\s\S]*set search_path = ''/i);
  assert.match(
    migration,
    /from public\.restaurant_memberships[\s\S]*membership\.status = 'active'/i
  );

  const grantExecute = migration.match(/grant execute on function[\s\S]*?;/gi) ?? [];
  assert.equal(grantExecute.length, 1);
  assert.match(grantExecute[0] ?? "", recordFunctionSignature);
  assert.match(grantExecute[0] ?? "", /to authenticated;/i);
  // security-backend.mjs forbids service_role EXECUTE on new public functions.
  assert.doesNotMatch(grantExecute[0] ?? "", /service_role/i);

  assert.match(migration, /revoke all on function[\s\S]*?from public, anon, authenticated, service_role/i);
});

test("recording is idempotent per attempt and rejects a reused key with a different payload", () => {
  assert.match(migration, /perform pg_advisory_xact_lock\([\s\S]*hashtextextended/i);
  assert.match(migration, /existing_run\.cycle is distinct from p_cycle/i);
  assert.match(migration, /existing_run\.attempt is distinct from p_attempt/i);
  assert.match(migration, /existing_run\.failure_reason is distinct from normalized_reason/i);
  assert.match(migration, /return existing_run;/i);

  // The mandated SQLSTATEs: authz, bad input, idempotency conflict.
  assert.match(migration, /errcode = '42501'/);
  assert.match(migration, /errcode = '22023'/);
  assert.match(migration, /errcode = '23505'/);
});

test("the attempt bound cannot silently drift from the domain constant", () => {
  assert.equal(RECALCULATION_MAX_ATTEMPTS, 4);
  assert.match(
    migration,
    new RegExp(`attempt smallint not null check \\(attempt between 1 and ${RECALCULATION_MAX_ATTEMPTS}\\)`, "i")
  );
  assert.match(
    migration,
    new RegExp(`p_attempt > ${RECALCULATION_MAX_ATTEMPTS}`, "i")
  );
  assert.match(migration, new RegExp(`event_attention := new\\.attempt >= ${RECALCULATION_MAX_ATTEMPTS}`, "i"));
});

test("run outcomes project into the operator feed using existing activity vocabulary", () => {
  assert.match(migration, /after insert on public\.recalculation_runs/i);
  assert.match(migration, /private\.append_activity_event/i);
  // No new activity type is introduced; automation_failed already routes to the
  // errors filter and forecast_updated is the opening success beat.
  assert.match(migration, /event_type := 'automation_failed'/i);
  assert.match(migration, /event_type := 'forecast_updated'/i);
  assert.doesNotMatch(migration, /'recalculation_(?:failed|completed|started)'\s*,/i);

  // Only the dead-lettered attempt demands a human.
  assert.match(migration, /event_attention := new\.attempt >= 4/i);
  assert.match(migration, /event_attention := false/i);
  // Original ledger migration kept mid_shift and close successes ledger-only.
  assert.match(migration, /new\.cycle <> 'daily_open'[\s\S]*return new;/i);

  assert.match(migration, /format\('recalculation_run:%s', new\.id\)/i);
  assert.match(migration, /format\('recalculation:%s:%s', new\.operating_date, new\.cycle\)/i);
  assert.match(migration, /'recalculation_timed_out'/i);
  assert.match(
    migration,
    /revoke all on function private\.capture_recalculation_run_activity\(\)\s*from public, anon, authenticated, service_role/i
  );
});

test("close-cycle migration projects closing reconciliation success into activity", () => {
  const closeMigration = readFileSync(
    new URL(
      "../supabase/migrations/20260826220000_close_cycle_reconciliation_activity.sql",
      import.meta.url
    ),
    "utf8"
  );
  assert.match(closeMigration, /Closing reconciliation completed/);
  assert.match(closeMigration, /new\.cycle = 'mid_shift'[\s\S]*return new;/i);
  assert.match(closeMigration, /new\.cycle <> 'daily_open' and new\.cycle <> 'close'/i);
  assert.match(closeMigration, /Opening recalculation completed/);
  assert.match(pgTap, /Closing reconciliation completed/);
  assert.match(pgTap, /mid_shift success stays ledger-only/);
});

test("the pgTAP suite covers the authority, replay, and isolation scenarios", () => {
  assert.match(pgTap, /select plan\(\d+\)/i);
  assert.match(pgTap, /relrowsecurity/i);
  assert.match(pgTap, /has_table_privilege\('anon'/i);
  assert.match(pgTap, /has_function_privilege/i);
  assert.match(pgTap, /pg_temp\.try_execute/i);
  assert.match(pgTap, /requires_attention/i);
  assert.match(pgTap, /select \* from finish\(\)/i);
});

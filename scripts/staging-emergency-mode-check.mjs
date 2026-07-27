import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

import { assertStagingPreflight } from "./staging-preflight.mjs";

const exec = promisify(execFile);
for (const name of [
  "SUPABASE_STAGING_URL",
  "SUPABASE_STAGING_PROJECT_REF",
  "SUPABASE_STAGING_ANON_KEY",
  "SUPABASE_STAGING_DB_PASSWORD",
  "MISE_STAGING_MARKER"
]) {
  if (!process.env[name]) throw new Error(`${name} is required.`);
}
await assertStagingPreflight();

const postgresBin = [
  "/Applications/Postgres.app/Contents/Versions/latest/bin",
  "/opt/homebrew/opt/postgresql@17/bin"
].find((candidate) => existsSync(join(candidate, "psql")));
if (!postgresBin) throw new Error("psql is required.");

const host = `db.${process.env.SUPABASE_STAGING_PROJECT_REF}.supabase.co`;
const psqlEnv = {
  ...process.env,
  PGPASSWORD: process.env.SUPABASE_STAGING_DB_PASSWORD,
  PGSSLMODE: "require",
  PGCONNECT_TIMEOUT: "15",
  PGOPTIONS: "-c statement_timeout=30000 -c lock_timeout=10000",
  PGTZ: "UTC"
};
const fixture = JSON.parse(
  await query(`
    select json_build_object(
      'user_id', memberships.user_id,
      'restaurant_id', items.restaurant_id,
      'item_id', items.id,
      'unit', items.canonical_unit
    )::text
    from public.inventory_items items
    join public.restaurant_memberships memberships
      on memberships.restaurant_id = items.restaurant_id
     and memberships.status = 'active'
     and memberships.role in ('owner', 'admin', 'manager')
    where items.canonical_unit_verification_status = 'verified'
      and items.canonical_unit in ('g', 'ml', 'each')
    order by memberships.created_at
    limit 1;
  `)
);
for (const field of ["user_id", "restaurant_id", "item_id", "unit"]) {
  if (!fixture[field]) throw new Error(`Staging fixture has no ${field}.`);
}
if ((await query("select operational_mode from public.system_operational_controls where singleton;")) !== "normal") {
  throw new Error("Staging must begin in normal mode.");
}

const blockedRequest = randomUUID();
const blockedClientEvent = randomUUID();
const blockedSql = `
  begin;
  select * from public.service_set_system_operational_mode(
    '${blockedRequest}'::uuid, 'read_only', 'hosted_read_only_proof', null
  );
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '${fixture.user_id}', true);
  select public.record_inventory_event(
    '${fixture.restaurant_id}'::uuid,
    '${fixture.item_id}'::uuid,
    'count',
    1,
    '${fixture.unit}',
    now(),
    'manual',
    'emergency-mode-check',
    'hosted_read_only_proof',
    '${blockedClientEvent}',
    'inventory:${blockedClientEvent}',
    null,
    '{}'::jsonb
  );
`;
const blocked = await queryExpectingFailure(blockedSql);
if (!/temporarily read-only|Tenant changes are paused/i.test(blocked)) {
  throw new Error("Read-only proof failed for an unexpected reason.");
}
await assertNormalAndAbsent(blockedRequest);

const replayRequest = randomUUID();
const replay = await query(`
  begin;
  select duplicate::text from public.service_set_system_operational_mode(
    '${replayRequest}'::uuid, 'integrations_paused', 'hosted_replay_proof', null
  );
  select duplicate::text from public.service_set_system_operational_mode(
    '${replayRequest}'::uuid, 'integrations_paused', 'hosted_replay_proof', null
  );
  rollback;
`);
if (replay.split("\n").filter((line) => /^(false|true)$/.test(line)).join("|") !== "false|true") {
  throw new Error("Operational mode replay was not exactly false then true.");
}
await assertNormalAndAbsent(replayRequest);

console.log(
  "Mise hosted emergency-mode proof passed: service-only transition, authenticated read-only denial, replay deduplication, and rollback to normal."
);

async function assertNormalAndAbsent(requestId) {
  const state = await query(`
    select json_build_object(
      'mode', (select operational_mode from public.system_operational_controls where singleton),
      'request_rows', (select count(*) from private.operational_mode_changes where request_id = '${requestId}'::uuid)
    )::text;
  `);
  const parsed = JSON.parse(state);
  if (parsed.mode !== "normal" || Number(parsed.request_rows) !== 0) {
    throw new Error("Hosted proof did not roll back cleanly to normal mode.");
  }
}

async function query(sql) {
  const result = await exec(join(postgresBin, "psql"), [
    "--no-psqlrc",
    "--quiet",
    "--tuples-only",
    "--no-align",
    "--set", "ON_ERROR_STOP=1",
    "--host", host,
    "--port", "5432",
    "--username", "postgres",
    "--dbname", "postgres",
    "--command", sql
  ], { env: psqlEnv, maxBuffer: 2 * 1024 * 1024, timeout: 60_000 });
  return result.stdout.trim();
}

async function queryExpectingFailure(sql) {
  try {
    await query(sql);
  } catch (error) {
    return `${error?.stderr ?? ""}\n${error?.message ?? ""}`;
  }
  throw new Error("Expected the authenticated mutation to be blocked.");
}

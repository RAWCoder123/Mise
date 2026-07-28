import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

import { assertStagingPreflight } from "./staging-preflight.mjs";

const exec = promisify(execFile);
for (const name of [
  "SUPABASE_STAGING_URL",
  "SUPABASE_STAGING_PROJECT_REF",
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

const controls = JSON.parse(
  await query(`
    select json_build_object(
      'system_rows', (
        select count(*) from public.system_operational_controls where singleton
      ),
      'system_safe', (
        select count(*)
        from public.system_operational_controls
        where singleton
          and operational_mode = 'normal'
          and ordering_policy = 'off'
          and not square_sync_enabled
          and not square_webhooks_enabled
          and not gmail_delivery_enabled
          and not insight_generation_enabled
          and not order_drafting_enabled
          and not stripe_invoicing_enabled
      ),
      'restaurant_rows', (
        select count(*) from public.restaurants
      ),
      'restaurant_control_rows', (
        select count(*) from public.restaurant_operational_controls
      ),
      'unsafe_restaurant_rows', (
        select count(*)
        from public.restaurant_operational_controls
        where ordering_policy <> 'off'
          or square_sync_enabled
          or square_webhooks_enabled
          or gmail_delivery_enabled
          or insight_generation_enabled
          or order_drafting_enabled
          or stripe_invoicing_enabled
      ),
      'service_role_can_bypass', has_function_privilege(
        'service_role',
        'private.service_claim_supplier_email_send_unchecked(uuid,uuid,uuid,uuid,text)',
        'EXECUTE'
      )
    )::text;
  `)
);

if (Number(controls.system_rows) !== 1 || Number(controls.system_safe) !== 1) {
  throw new Error("Staging global provider controls are not fail-closed.");
}
if (
  Number(controls.restaurant_rows) < 2 ||
  Number(controls.restaurant_rows) !== Number(controls.restaurant_control_rows)
) {
  throw new Error("Every staging restaurant must have one operational-control row.");
}
if (Number(controls.unsafe_restaurant_rows) !== 0) {
  throw new Error("A staging restaurant provider or ordering policy is unexpectedly enabled.");
}
if (controls.service_role_can_bypass !== false) {
  throw new Error("The staging service role can bypass the guarded provider claim.");
}

const actor = JSON.parse(
  await query(`
    select json_build_object(
      'user_id', membership.user_id,
      'restaurant_id', membership.restaurant_id
    )::text
    from public.restaurant_memberships membership
    where membership.status = 'active'
      and membership.role in ('owner', 'admin', 'manager')
    order by membership.created_at, membership.user_id
    limit 1;
  `)
);
if (!actor.user_id || !actor.restaurant_id) {
  throw new Error("Staging has no active manager fixture for the provider boundary proof.");
}

const blocked = JSON.parse(
  await query(`
    begin;
    set local role service_role;
    select json_build_object(
      'outcome', (
        public.service_claim_supplier_email_send(
          '${actor.user_id}'::uuid,
          '${actor.restaurant_id}'::uuid,
          '00000000-0000-4000-8000-000000000001'::uuid,
          '00000000-0000-4000-8000-000000000001'::uuid,
          '<mise-staging-provider-proof@mise.test>'
        )->>'outcome'
      ),
      'delivery_rows', (
        select count(*)
        from private.supplier_email_deliveries
        where restaurant_id = '${actor.restaurant_id}'::uuid
          and supplier_order_id = '00000000-0000-4000-8000-000000000001'::uuid
      )
    )::text;
    rollback;
  `)
);
if (blocked.outcome !== "provider_not_enabled" || Number(blocked.delivery_rows) !== 0) {
  throw new Error("The authoritative staging provider claim did not fail closed.");
}

console.log(
  "Mise staging provider proof passed: all provider flags off, ordering policy off, tenant controls complete, service-role bypass revoked, and supplier delivery blocked without evidence."
);

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

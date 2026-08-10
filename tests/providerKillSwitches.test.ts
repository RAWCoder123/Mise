import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  buildFinalAuthenticatedTablePrivileges,
  hasAuthenticatedTableDml,
} from "../scripts/sql-table-privileges.mjs";

const migration = readFileSync(
  "supabase/migrations/20260728203500_enforce_provider_kill_switches.sql",
  "utf8",
);
const revokeClientDml = readFileSync(
  "supabase/migrations/20260810120000_revoke_restaurant_operational_controls_client_dml.sql",
  "utf8",
);
const sendSupplierEmail = readFileSync(
  "supabase/functions/send-supplier-email/index.ts",
  "utf8",
);
const securityBackend = readFileSync("scripts/security-backend.mjs", "utf8");

test("supplier delivery requires persisted global and restaurant authorization", () => {
  assert.match(migration, /ordering_policy text not null default 'off'/i);
  assert.match(migration, /ordering_policy in \('off', 'draft_only'\)/i);
  assert.match(
    migration,
    /not order_drafting_enabled or ordering_policy = 'draft_only'/i,
  );
  assert.match(
    migration,
    /create trigger ensure_restaurant_operational_controls[\s\S]*after insert on public\.restaurants/i,
  );
  assert.match(
    migration,
    /rename to service_claim_supplier_email_send_unchecked/i,
  );
  assert.match(
    migration,
    /revoke all on function[\s\S]*service_claim_supplier_email_send_unchecked[\s\S]*service_role/i,
  );
  assert.match(
    migration,
    /gmail_service_actor_has_role[\s\S]*system_controls\.operational_mode <> 'normal'[\s\S]*system_controls\.gmail_delivery_enabled[\s\S]*restaurant_controls\.gmail_delivery_enabled/i,
  );
  assert.match(migration, /'outcome', 'provider_not_enabled'/i);
  assert.doesNotMatch(
    migration,
    /grant execute on function[\s\S]*service_claim_supplier_email_send_unchecked[\s\S]*to service_role/i,
  );
});

test("supplier delivery gives operators a safe disabled-provider fallback", () => {
  assert.match(sendSupplierEmail, /outcome === "provider_not_enabled"/i);
  assert.match(sendSupplierEmail, /status:\s*503/i);
  assert.match(sendSupplierEmail, /Copy or export the approved draft/i);
});

test("restaurant provider controls are SELECT-only for authenticated clients", () => {
  assert.match(
    revokeClientDml,
    /drop policy if exists "Owners and admins can update restaurant operational controls"/i,
  );
  assert.match(
    revokeClientDml,
    /revoke update on public\.restaurant_operational_controls from authenticated/i,
  );
  assert.match(
    revokeClientDml,
    /grant select on public\.restaurant_operational_controls to authenticated/i,
  );
  assert.match(securityBackend, /selectOnlyAuthenticatedTables/i);
  assert.match(
    securityBackend,
    /must not retain authenticated DML grants after service\/Edge ownership/i,
  );

  const migrationFiles = readdirSync("supabase/migrations")
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({
      path: name,
      sql: readFileSync(join("supabase/migrations", name), "utf8"),
    }));
  const inventory = buildFinalAuthenticatedTablePrivileges(migrationFiles);
  const restaurantControls = inventory.tables.get(
    "restaurant_operational_controls",
  );
  const systemControls = inventory.tables.get("system_operational_controls");

  assert.equal(inventory.unrecognizedPrivilegeStatements.length, 0);
  assert.equal(restaurantControls?.select, true);
  assert.equal(hasAuthenticatedTableDml(restaurantControls), false);
  assert.equal(systemControls?.select, true);
  assert.equal(hasAuthenticatedTableDml(systemControls), false);
});

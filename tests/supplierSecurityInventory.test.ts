import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260824034152_mise_003c_durable_supplier_identity.sql",
  "utf8"
);
const securityBackend = readFileSync("scripts/security-backend.mjs", "utf8");
const securityStatic = readFileSync("scripts/security-static.mjs", "utf8");
const tenantIsolation = readFileSync("supabase/tests/database/tenant_isolation.test.sql", "utf8");

function ownedTables(source: string): string {
  return source.match(/const restaurantOwnedTables = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? "";
}

function selectOnlyTables(source: string): string {
  return source.match(/const selectOnlyAuthenticatedTables = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? "";
}

test("durable suppliers are tenant-scoped, RLS-backed, and SELECT-only to clients", () => {
  assert.match(migration, /create table public\.suppliers/);
  assert.match(
    migration,
    /restaurant_id uuid not null references public\.restaurants\(id\) on delete cascade/
  );
  assert.match(migration, /alter table public\.suppliers enable row level security/);
  assert.match(
    migration,
    /create policy "Members can read suppliers"[\s\S]*for select to authenticated[\s\S]*private\.is_restaurant_member\(restaurant_id\)/
  );
  assert.match(
    migration,
    /revoke all on table public\.suppliers from public, anon, authenticated, service_role/
  );
  assert.match(migration, /grant select on table public\.suppliers to authenticated;/);
  assert.doesNotMatch(
    migration,
    /grant[^;]*\b(insert|update|delete)\b[^;]*on\s+(?:table\s+)?public\.suppliers[^;]*to authenticated/i
  );
});

test("suppliers are pinned in backend and static restaurant-owned inventories", () => {
  assert.match(ownedTables(securityBackend), /"suppliers"/, "backend must require restaurant_id + membership policy");
  assert.match(selectOnlyTables(securityBackend), /"suppliers"/, "backend must refuse authenticated DML grants");
  assert.match(ownedTables(securityStatic), /"suppliers"/, "static gate must scope destructive suppliers queries");
  assert.match(tenantIsolation, /'suppliers',/, "must remain in the reviewed Data API allowlist");
});

test("security gates discover create table without IF NOT EXISTS", () => {
  assert.match(
    securityBackend,
    /create\\s\+table\\s\+\(\?:if\\s\+not\\s\+exists\\s\+\)\?public\\./
  );
  assert.match(
    securityStatic,
    /create\\s\+table\\s\+\(\?:if\\s\+not\\s\+exists\\s\+\)\?public\\./
  );
  assert.match(securityBackend, /"operational_finding_decisions"/);
  assert.match(ownedTables(securityBackend), /"operational_finding_decisions"/);
  assert.match(selectOnlyTables(securityBackend), /"operational_finding_decisions"/);
  assert.match(
    securityBackend.match(/const serviceOnlyPublicTables = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? "",
    /"purchase_decision_events"/
  );
  assert.match(
    securityStatic.match(/const serviceOnlyPublicTables = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? "",
    /"purchase_decision_events"/
  );
});

test("security-static restaurantOwnedTables stays aligned with security-backend peers", () => {
  const backendOwned = new Set(
    [...ownedTables(securityBackend).matchAll(/"([a-z_]+)"/g)].map((match) => match[1])
  );
  const staticOwned = new Set(
    [...ownedTables(securityStatic).matchAll(/"([a-z_]+)"/g)].map((match) => match[1])
  );

  assert.deepEqual(
    [...staticOwned].sort(),
    [...backendOwned].sort(),
    "static destructive-query inventory must match backend restaurant-owned tables"
  );
});

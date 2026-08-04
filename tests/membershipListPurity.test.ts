import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260804120000_list_my_restaurant_memberships.sql",
  "utf8"
);
const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
const session = readFileSync("contexts/MiseSessionContext.tsx", "utf8");
const hydration = readFileSync("services/domain/sessionHydration.ts", "utf8");

test("list_my_restaurant_memberships is identity-free, archived-aware, and read-only", () => {
  assert.match(migration, /function public\.list_my_restaurant_memberships\(\)/i);
  assert.match(migration, /Identity-free active membership reads bound to auth\.uid\(\)/i);
  assert.match(migration, /membership\.user_id = actor_user_id/i);
  assert.match(migration, /membership\.status = 'active'/i);
  assert.match(migration, /restaurant\.archived_at is null/i);
  assert.match(migration, /returns setof public\.restaurant_memberships/i);
  assert.doesNotMatch(migration, /update\s+public\.restaurant_memberships/i);
  assert.doesNotMatch(migration, /p_user_id/i);
  assert.match(
    migration,
    /revoke all on function public\.list_my_restaurant_memberships\(\)[\s\S]*from public, anon, authenticated, service_role/i
  );
  assert.match(
    migration,
    /grant execute on function public\.list_my_restaurant_memberships\(\)[\s\S]*authenticated/i
  );
});

test("hosted membership list uses the identity-free RPC instead of user_id table filters", () => {
  const hostedRepository = repository.match(/function createSupabaseRepository\([\s\S]*$/)?.[0] ?? "";
  const hostedLoad =
    hostedRepository.match(/async fetchMembershipsForAuthUser\([\s\S]*?\n    \},/)?.[0] ?? "";
  assert.match(hostedLoad, /\.rpc\(\s*["']list_my_restaurant_memberships["']/);
  assert.doesNotMatch(hostedLoad, /\.from\(\s*["']restaurant_memberships["']/);
  assert.doesNotMatch(hostedLoad, /\.eq\(\s*["']user_id["']/);
});

test("demo membership list excludes archived restaurants", () => {
  const demoLoad =
    repository.match(
      /function createLocalDemoRepository\(\): MiseRepository \{[\s\S]*?async fetchMembershipsForAuthUser\([\s\S]*?\n    \},/
    )?.[0] ?? "";
  assert.match(demoLoad, /archived_at/);
  assert.match(demoLoad, /activeRestaurantIds/);
  assert.doesNotMatch(demoLoad, /\.rpc\(\s*["']list_my_restaurant_memberships["']/);
});

test("session hydration keeps only loadable memberships after restaurant settle", () => {
  assert.match(hydration, /loadableMemberships/);
  assert.match(hydration, /archived_at/);
  assert.match(session, /setMemberships\(loadableMemberships\)/);
});

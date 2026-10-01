import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260903030000_leave_my_restaurant_membership.sql",
  "utf8"
);
const repository = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
const settings = readFileSync("app/(tabs)/settings.tsx", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");

test("leave_my_restaurant_membership is auth-bound, owner-blocked, and audited", () => {
  assert.match(migration, /create or replace function public\.leave_my_restaurant_membership\(/i);
  assert.match(migration, /security definer/i);
  assert.match(migration, /set search_path = ''/i);
  assert.match(migration, /auth\.uid\(\)/i);
  assert.match(migration, /Owners cannot leave without transferring ownership/i);
  assert.match(migration, /status is distinct from 'active'/i);
  assert.match(migration, /action,\s*[\s\S]*'membership_left'/i);
  assert.match(migration, /grant execute on function public\.leave_my_restaurant_membership\(uuid\) to authenticated/i);
  assert.match(
    migration,
    /revoke all on function public\.leave_my_restaurant_membership\(uuid\)[\s\S]*service_role/i
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.leave_my_restaurant_membership\(uuid\) to service_role/i
  );
});

test("hosted repository and settings wire leave through the guarded RPC", () => {
  assert.match(repository, /rpc\(\s*"leave_my_restaurant_membership"/);
  assert.match(settings, /leaveMyRestaurantMembership/);
  assert.match(settings, /canLeaveRestaurantMembership/);
  assert.match(settings, /refreshWorkspaceAccess/);
  assert.match(settings, /!usingLocalDemo/);
  assert.match(catalog, /"settings\.account\.leaveTitle"/);
  assert.match(catalog, /"settings\.notice\.leaveRestaurantDenied"/);
});

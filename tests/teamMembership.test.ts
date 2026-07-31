import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

import {
  canActorChangeMemberRole,
  canActorChangeMemberStatus,
  canActorRemoveMember,
  canManageRestaurantTeam,
  canViewRestaurantTeam,
  compareTeamMembers,
  isValidMemberEmail,
  normalizeMemberEmail,
  rolesAssignableBy
} from "../services/domain/teamMembership.ts";
import {
  canManageTeamForRestaurant,
  canViewMemberInvitesForRestaurant,
  canViewTeamForRestaurant
} from "../services/tenantAccess.ts";
import type { RestaurantMembership } from "../types/mise.ts";

function membership(role: RestaurantMembership["role"], status: RestaurantMembership["status"] = "active"): RestaurantMembership {
  return {
    id: `m_${role}`,
    restaurant_id: "restaurant_a",
    user_id: `user_${role}`,
    role,
    status,
    created_at: "2026-07-30T00:00:00.000Z",
    updated_at: "2026-07-30T00:00:00.000Z"
  };
}

test("team email normalization rejects unsafe addresses", () => {
  assert.equal(normalizeMemberEmail("  Alex@Demo.Mise "), "alex@demo.mise");
  assert.equal(isValidMemberEmail("alex@demo.mise"), true);
  assert.equal(isValidMemberEmail("not-an-email"), false);
  assert.equal(isValidMemberEmail("a@b"), false);
  assert.equal(isValidMemberEmail("bad\n@demo.mise"), false);
});

test("team role hierarchy mirrors RPC authority", () => {
  assert.deepEqual(rolesAssignableBy("owner"), ["admin", "manager", "staff"]);
  assert.deepEqual(rolesAssignableBy("admin"), ["manager", "staff"]);
  assert.deepEqual(rolesAssignableBy("manager"), []);
  assert.equal(canViewRestaurantTeam("manager"), true);
  assert.equal(canManageRestaurantTeam("manager"), false);
  assert.equal(canActorChangeMemberRole("owner", "staff", "manager"), true);
  assert.equal(canActorChangeMemberRole("admin", "admin", "staff"), false);
  assert.equal(canActorChangeMemberRole("admin", "staff", "admin"), false);
  assert.equal(canActorChangeMemberStatus("owner", "manager", "disabled"), true);
  assert.equal(canActorChangeMemberStatus("admin", "admin", "disabled"), false);
  assert.equal(canActorRemoveMember("owner", "admin"), true);
  assert.equal(canActorRemoveMember("admin", "admin"), false);
  assert.equal(canActorRemoveMember("owner", "owner"), false);
});

test("tenant helpers gate team screens by active membership role", () => {
  assert.equal(canViewTeamForRestaurant([membership("manager")], "restaurant_a"), true);
  assert.equal(canManageTeamForRestaurant([membership("manager")], "restaurant_a"), false);
  assert.equal(canViewMemberInvitesForRestaurant([membership("manager")], "restaurant_a"), true);
  assert.equal(canManageTeamForRestaurant([membership("owner")], "restaurant_a"), true);
  assert.equal(canViewMemberInvitesForRestaurant([membership("owner")], "restaurant_a"), true);
  assert.equal(canViewTeamForRestaurant([membership("staff")], "restaurant_a"), false);
  assert.equal(canViewMemberInvitesForRestaurant([membership("staff")], "restaurant_a"), false);
  assert.equal(canViewTeamForRestaurant([membership("owner", "disabled")], "restaurant_a"), false);
  assert.equal(canViewMemberInvitesForRestaurant([membership("owner", "disabled")], "restaurant_a"), false);
});

test("team settings screen loads pending invites for managers without revoke controls", () => {
  const screen = readFileSync("app/settings/team.tsx", "utf8");
  assert.match(screen, /canViewMemberInvitesForRestaurant/);
  assert.match(screen, /canViewInvites \? fetchRestaurantMemberInvites/);
  assert.match(screen, /pendingInvitesReadOnlyBody/);
  assert.match(screen, /canActorRevokeMemberInvite\(role, invite\.role\)/);
  assert.doesNotMatch(screen, /canManage \? fetchRestaurantMemberInvites/);
});

test("team member sorting prefers owners then active status", () => {
  const sorted = [
    { role: "staff" as const, status: "active" as const, email: "z@demo.mise" },
    { role: "owner" as const, status: "active" as const, email: "a@demo.mise" },
    { role: "manager" as const, status: "disabled" as const, email: "m@demo.mise" },
    { role: "manager" as const, status: "active" as const, email: "b@demo.mise" }
  ].sort(compareTeamMembers);
  assert.deepEqual(
    sorted.map((entry) => `${entry.role}:${entry.status}:${entry.email}`),
    ["owner:active:a@demo.mise", "manager:active:b@demo.mise", "manager:disabled:m@demo.mise", "staff:active:z@demo.mise"]
  );
});

test("restaurant team directory migration and client wiring are present", () => {
  const migration = readFileSync("supabase/migrations/20260730231100_restaurant_team_directory.sql", "utf8");
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const screen = readFileSync("app/settings/team.tsx", "utf8");
  const settings = readFileSync("app/(tabs)/settings.tsx", "utf8");
  const routes = readFileSync("scripts/mobile-route-smoke.mjs", "utf8");

  assert.match(migration, /create or replace function public\.list_restaurant_members/i);
  assert.match(migration, /create or replace function public\.add_restaurant_member_by_email/i);
  assert.match(migration, /restaurant_member_added/i);
  assert.match(migration, /grant execute on function public\.list_restaurant_members\(uuid\) to authenticated/i);
  assert.match(repository, /rpc\("list_restaurant_members"/i);
  assert.match(repository, /rpc\("add_restaurant_member_by_email"/i);
  assert.match(repository, /listDemoTeamMembers/i);
  assert.match(screen, /fetchRestaurantTeamMembers/i);
  assert.match(screen, /canManageTeamForRestaurant/i);
  assert.match(settings, /settings\/team/i);
  assert.match(routes, /\/settings\/team/);
});

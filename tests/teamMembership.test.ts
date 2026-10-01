import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  assignableTeamRoles,
  canEditTeamMember,
  canManageTeam,
  isTeamMemberAccessDisabled,
  nextTeamMemberAccessStatus,
  normalizeTeamMemberEmail,
  sortTeamMembers,
  TeamMembershipError,
  teamMembershipErrorFrom
} from "../services/domain/teamMembership";
import type { RestaurantTeamMember } from "../types/mise";

function member(partial: Partial<RestaurantTeamMember> & Pick<RestaurantTeamMember, "user_id" | "role">): RestaurantTeamMember {
  return {
    restaurant_id: "rest_1",
    status: "active",
    name: null,
    email: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...partial
  };
}

test("owners and admins can manage team membership; managers and staff cannot", () => {
  assert.deepEqual(assignableTeamRoles("owner"), ["admin", "manager", "staff"]);
  assert.deepEqual(assignableTeamRoles("admin"), ["manager", "staff"]);
  assert.deepEqual(assignableTeamRoles("manager"), []);
  assert.deepEqual(assignableTeamRoles("staff"), []);
  assert.equal(canManageTeam("owner"), true);
  assert.equal(canManageTeam("admin"), true);
  assert.equal(canManageTeam("manager"), false);
});

test("edit rules protect owners, self, invitations, and admin authority boundaries", () => {
  assert.equal(canEditTeamMember("owner", { role: "admin", isSelf: false }), true);
  assert.equal(canEditTeamMember("owner", { role: "owner", isSelf: false }), false);
  assert.equal(canEditTeamMember("owner", { role: "staff", isSelf: true }), false);
  assert.equal(canEditTeamMember("admin", { role: "manager", isSelf: false }), true);
  assert.equal(canEditTeamMember("admin", { role: "admin", isSelf: false }), false);
  assert.equal(canEditTeamMember("manager", { role: "staff", isSelf: false }), false);
  assert.equal(
    canEditTeamMember("owner", { role: "staff", isSelf: false, status: "invited" }),
    false
  );
  assert.equal(
    canEditTeamMember("owner", { role: "staff", isSelf: false, status: "disabled" }),
    true
  );
});

test("access disable toggles between active and disabled only", () => {
  assert.equal(isTeamMemberAccessDisabled("disabled"), true);
  assert.equal(isTeamMemberAccessDisabled("active"), false);
  assert.equal(isTeamMemberAccessDisabled("invited"), false);
  assert.equal(nextTeamMemberAccessStatus("active"), "disabled");
  assert.equal(nextTeamMemberAccessStatus("disabled"), "active");
  assert.equal(nextTeamMemberAccessStatus("invited"), null);
});

test("team member emails are normalized and rejected when unusable", () => {
  assert.equal(normalizeTeamMemberEmail("  Chef@Bistro.co  "), "chef@bistro.co");
  assert.equal(normalizeTeamMemberEmail("not-an-email"), null);
  assert.equal(normalizeTeamMemberEmail("a@b"), null);
  assert.equal(normalizeTeamMemberEmail(`${"a".repeat(250)}@x.com`), null);
});

test("team members sort by role rank then created_at", () => {
  const sorted = sortTeamMembers([
    member({ user_id: "staff_old", role: "staff", created_at: "2026-07-01T00:00:00.000Z" }),
    member({ user_id: "admin", role: "admin", created_at: "2026-07-03T00:00:00.000Z" }),
    member({ user_id: "staff_new", role: "staff", created_at: "2026-07-04T00:00:00.000Z" }),
    member({ user_id: "owner", role: "owner", created_at: "2026-07-02T00:00:00.000Z" })
  ]);
  assert.deepEqual(
    sorted.map((entry) => entry.user_id),
    ["owner", "admin", "staff_old", "staff_new"]
  );
});

test("Postgres membership failures map onto operator-facing statuses", () => {
  assert.equal(teamMembershipErrorFrom({ code: "23505", message: "dup" }).status, "already_member");
  assert.equal(teamMembershipErrorFrom({ code: "P0002", message: "missing" }).status, "account_not_found");
  assert.equal(teamMembershipErrorFrom({ code: "42501", message: "denied" }).status, "permission_denied");
  assert.equal(teamMembershipErrorFrom(new Error("boom")).status, "unknown");
  const original = new TeamMembershipError("already_member", "exists");
  assert.equal(teamMembershipErrorFrom(original), original);
});

test("Team Settings wires reversible access disable through updateRestaurantMember status", () => {
  const team = readFileSync(new URL("../app/settings/team.tsx", import.meta.url), "utf8");
  assert.match(team, /nextTeamMemberAccessStatus\(member\.status\)/);
  assert.match(
    team,
    /updateRestaurantMember\(restaurant\.id, member\.user_id, \{\s*status: nextStatus\s*\}\)/
  );
  assert.match(team, /statusKeys\[member\.status\]/);
  assert.match(team, /canEditTeamMember\(role, \{\s*role: member\.role,\s*isSelf,\s*status: member\.status\s*\}\)/);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

import {
  buildInviteClaimPath,
  canActorCreateMemberInvite,
  canActorRevokeMemberInvite,
  canViewMemberInvites,
  generateInviteToken,
  hashInviteToken,
  isInvitePending,
  isValidInviteToken,
  normalizeInviteToken,
  resolveInviteExpiryHours
} from "../services/domain/teamInvites.ts";
import {
  claimDemoMemberInvite,
  createDemoMemberInvite,
  listDemoMemberInvites,
  revokeDemoMemberInvite
} from "../services/demo/memberInvites.ts";
import {
  createInitialDemoState,
  DEMO_RESTAURANT_ID,
  DEMO_USER_ID,
  repairDemoState
} from "../services/demo/replaceableDemoData.ts";

test("invite tokens are opaque 64-char hex values", async () => {
  const token = generateInviteToken();
  assert.equal(isValidInviteToken(token), true);
  assert.equal(normalizeInviteToken(` ${token.toUpperCase()} `), token);
  const hash = await hashInviteToken(token);
  assert.equal(hash.length, 64);
  assert.notEqual(hash, token);
  assert.equal(buildInviteClaimPath(token), `/invite/${token}`);
  assert.equal(resolveInviteExpiryHours(null), 168);
  assert.throws(() => resolveInviteExpiryHours(0));
});

test("invite authority mirrors membership hierarchy", () => {
  assert.equal(canActorCreateMemberInvite("owner", "admin"), true);
  assert.equal(canActorCreateMemberInvite("admin", "staff"), true);
  assert.equal(canActorCreateMemberInvite("admin", "admin"), false);
  assert.equal(canActorCreateMemberInvite("manager", "staff"), false);
  assert.equal(canActorRevokeMemberInvite("owner", "admin"), true);
  assert.equal(canActorRevokeMemberInvite("admin", "manager"), true);
  assert.equal(canActorRevokeMemberInvite("admin", "admin"), false);
  assert.equal(canActorRevokeMemberInvite("manager", "staff"), false);
  assert.equal(canViewMemberInvites("owner"), true);
  assert.equal(canViewMemberInvites("admin"), true);
  assert.equal(canViewMemberInvites("manager"), true);
  assert.equal(canViewMemberInvites("staff"), false);
});

test("pending invite expiry helper treats past timestamps as inactive", () => {
  assert.equal(
    isInvitePending("pending", "2026-08-01T00:00:00.000Z", new Date("2026-07-31T12:00:00.000Z")),
    true
  );
  assert.equal(
    isInvitePending("pending", "2026-07-30T00:00:00.000Z", new Date("2026-07-31T12:00:00.000Z")),
    false
  );
  assert.equal(
    isInvitePending("revoked", "2026-08-01T00:00:00.000Z", new Date("2026-07-31T12:00:00.000Z")),
    false
  );
});

test("demo invite create, revoke, and claim stay tenant-bound", async () => {
  const state = createInitialDemoState("Toast");
  const created = await createDemoMemberInvite(
    state,
    DEMO_RESTAURANT_ID,
    "new.cook@mise.test",
    "staff",
    DEMO_USER_ID,
    24
  );
  assert.equal(created.status, "pending");
  assert.equal(isValidInviteToken(created.claim_token), true);
  assert.equal(created.email, "new.cook@mise.test");

  const listed = listDemoMemberInvites(state, DEMO_RESTAURANT_ID, DEMO_USER_ID);
  assert.equal(listed.some((invite) => invite.id === created.id && invite.status === "pending"), true);

  await assert.rejects(
    () => claimDemoMemberInvite(state, created.claim_token, DEMO_USER_ID),
    /email does not match/i
  );

  const inviteeId = "invitee-user-1";
  state.users.push({
    id: inviteeId,
    restaurant_id: null,
    name: "New Cook",
    email: "new.cook@mise.test",
    role: "staff",
    created_at: new Date().toISOString()
  });

  const membership = await claimDemoMemberInvite(state, created.claim_token, inviteeId);
  assert.equal(membership.restaurant_id, DEMO_RESTAURANT_ID);
  assert.equal(membership.user_id, inviteeId);
  assert.equal(membership.role, "staff");
  assert.equal(membership.status, "active");

  await assert.rejects(
    () => claimDemoMemberInvite(state, created.claim_token, inviteeId),
    /already been claimed|already exists/i
  );
});

test("demo invite revoke blocks later claims", async () => {
  const state = createInitialDemoState("Toast");
  const created = await createDemoMemberInvite(
    state,
    DEMO_RESTAURANT_ID,
    "revoked.cook@mise.test",
    "manager",
    DEMO_USER_ID
  );
  const revoked = revokeDemoMemberInvite(state, DEMO_RESTAURANT_ID, created.id, DEMO_USER_ID);
  assert.equal(revoked.status, "revoked");

  const inviteeId = "invitee-user-2";
  state.users.push({
    id: inviteeId,
    restaurant_id: null,
    name: "Revoked Cook",
    email: "revoked.cook@mise.test",
    role: "manager",
    created_at: new Date().toISOString()
  });

  await assert.rejects(
    () => claimDemoMemberInvite(state, created.claim_token, inviteeId),
    /revoked/i
  );
});

test("demo schema includes member invite storage", () => {
  const seed = createInitialDemoState("Toast");
  assert.equal(seed.schema_version, 8);
  assert.deepEqual(seed.memberInvites, []);

  const { memberInvites: _ignored, schema_version: _version, ...legacy } = seed;
  const repaired = repairDemoState({ ...legacy, schema_version: 5 });
  assert.equal(repaired.migrated, true);
  assert.equal(repaired.state.schema_version, 8);
  assert.ok(Array.isArray(repaired.state.memberInvites));
});

test("member invite migration and client wiring are present", () => {
  const migration = readFileSync("supabase/migrations/20260731152000_restaurant_member_invites.sql", "utf8");
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const demoInvites = readFileSync("services/demo/memberInvites.ts", "utf8");
  const screen = readFileSync("app/settings/team.tsx", "utf8");
  const claimScreen = readFileSync("app/invite/[token].tsx", "utf8");
  const routes = readFileSync("scripts/mobile-route-smoke.mjs", "utf8");
  const securityBackend = readFileSync("scripts/security-backend.mjs", "utf8");

  assert.match(migration, /create table if not exists public\.restaurant_member_invites/i);
  assert.match(migration, /create or replace function public\.create_restaurant_member_invite/i);
  assert.match(migration, /create or replace function public\.claim_restaurant_member_invite/i);
  assert.match(migration, /revoke all on public\.restaurant_member_invites from anon, authenticated/i);
  assert.match(migration, /restaurant_member_invite_created/i);
  assert.match(securityBackend, /restaurant_member_invites/);
  assert.match(repository, /rpc\("create_restaurant_member_invite"/i);
  assert.match(repository, /rpc\("claim_restaurant_member_invite"/i);
  assert.match(demoInvites, /export async function createDemoMemberInvite/i);
  assert.match(screen, /createRestaurantMemberInvite/i);
  assert.match(screen, /revokeRestaurantMemberInvite/i);
  assert.match(claimScreen, /claimRestaurantMemberInvite/i);
  assert.match(routes, /\/invite\//);
});

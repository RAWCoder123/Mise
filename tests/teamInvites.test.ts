import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

import {
  buildInviteClaimPath,
  canActorCreateMemberInvite,
  canActorRevokeMemberInvite,
  generateInviteToken,
  hashInviteToken,
  isInvitePending,
  isValidInviteToken,
  normalizeInviteToken,
  resolveInviteExpiryHours
} from "../services/domain/teamInvites.ts";
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
  const { createMiseRepository } = await import("../services/repositories/miseRepository.ts");
  const { resetDemoStore } = await import("../services/localStore.ts");

  await resetDemoStore("Toast");
  const repository = createMiseRepository();

  const created = await repository.createRestaurantMemberInvite(
    DEMO_RESTAURANT_ID,
    "new.cook@mise.test",
    "staff",
    24
  );
  assert.equal(created.status, "pending");
  assert.equal(isValidInviteToken(created.claim_token), true);
  assert.equal(created.email, "new.cook@mise.test");

  const listed = await repository.fetchRestaurantMemberInvites(DEMO_RESTAURANT_ID);
  assert.equal(listed.some((invite) => invite.id === created.id && invite.status === "pending"), true);

  await assert.rejects(
    () => repository.claimRestaurantMemberInvite(created.claim_token),
    /email does not match/i
  );

  const { mutateDemoState } = await import("../services/localStore.ts");
  await mutateDemoState((state) => {
    const owner = state.users.find((entry) => entry.id === DEMO_USER_ID);
    assert.ok(owner);
    owner.email = "new.cook@mise.test";
    // Demo repository always acts as DEMO_USER_ID; drop the owner membership so claim can bind it.
    state.memberships = state.memberships.filter((membership) => membership.user_id !== DEMO_USER_ID);
  });

  const membership = await repository.claimRestaurantMemberInvite(created.claim_token);
  assert.equal(membership.restaurant_id, DEMO_RESTAURANT_ID);
  assert.equal(membership.user_id, DEMO_USER_ID);
  assert.equal(membership.role, "staff");
  assert.equal(membership.status, "active");

  await assert.rejects(
    () => repository.claimRestaurantMemberInvite(created.claim_token),
    /already been claimed|already exists/i
  );
});

test("demo invite revoke blocks later claims", async () => {
  const { createMiseRepository } = await import("../services/repositories/miseRepository.ts");
  const { resetDemoStore, mutateDemoState } = await import("../services/localStore.ts");

  await resetDemoStore("Toast");
  const repository = createMiseRepository();
  const created = await repository.createRestaurantMemberInvite(
    DEMO_RESTAURANT_ID,
    "revoked.cook@mise.test",
    "manager"
  );
  const revoked = await repository.revokeRestaurantMemberInvite(DEMO_RESTAURANT_ID, created.id);
  assert.equal(revoked.status, "revoked");

  await mutateDemoState((state) => {
    const owner = state.users.find((entry) => entry.id === DEMO_USER_ID);
    assert.ok(owner);
    owner.email = "revoked.cook@mise.test";
  });

  await assert.rejects(
    () => repository.claimRestaurantMemberInvite(created.claim_token),
    /revoked/i
  );
});

test("demo schema v6 includes member invite storage", () => {
  const seed = createInitialDemoState("Toast");
  assert.equal(seed.schema_version, 6);
  assert.deepEqual(seed.memberInvites, []);

  const { memberInvites: _ignored, schema_version: _version, ...legacy } = seed;
  const repaired = repairDemoState({ ...legacy, schema_version: 5 });
  assert.equal(repaired.migrated, true);
  assert.equal(repaired.state.schema_version, 6);
  assert.ok(Array.isArray(repaired.state.memberInvites));
});

test("member invite migration and client wiring are present", () => {
  const migration = readFileSync("supabase/migrations/20260731152000_restaurant_member_invites.sql", "utf8");
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const screen = readFileSync("app/settings/team.tsx", "utf8");
  const claimScreen = readFileSync("app/invite/[token].tsx", "utf8");
  const routes = readFileSync("scripts/mobile-route-smoke.mjs", "utf8");
  const securityBackend = readFileSync("scripts/security-backend.mjs", "utf8");

  assert.match(migration, /create table if not exists public\.restaurant_member_invites/i);
  assert.match(migration, /create or replace function public\.create_restaurant_member_invite/i);
  assert.match(migration, /create or replace function public\.claim_restaurant_member_invite/i);
  assert.match(migration, /revoke all on table public\.restaurant_member_invites from public, anon, authenticated/i);
  assert.match(migration, /restaurant_member_invite_created/i);
  assert.match(securityBackend, /restaurant_member_invites/);
  assert.match(repository, /rpc\("create_restaurant_member_invite"/i);
  assert.match(repository, /rpc\("claim_restaurant_member_invite"/i);
  assert.match(repository, /createDemoMemberInvite/i);
  assert.match(screen, /createRestaurantMemberInvite/i);
  assert.match(screen, /revokeRestaurantMemberInvite/i);
  assert.match(claimScreen, /claimRestaurantMemberInvite/i);
  assert.match(routes, /\/invite\//);
});

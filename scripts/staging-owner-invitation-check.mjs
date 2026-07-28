import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";

import { parseInviteCallbackUrl } from "../services/domain/accountAuth.ts";
import { assertStagingPreflight } from "./staging-preflight.mjs";

const exec = promisify(execFile);
for (const name of [
  "SUPABASE_STAGING_URL",
  "SUPABASE_STAGING_PROJECT_REF",
  "SUPABASE_STAGING_ANON_KEY",
  "SUPABASE_STAGING_SECRET_KEY",
  "MISE_STAGING_MARKER"
]) {
  if (!process.env[name]) throw new Error(`${name} is required.`);
}
await assertStagingPreflight();

const url = process.env.SUPABASE_STAGING_URL;
const anonKey = process.env.SUPABASE_STAGING_ANON_KEY;
const secretKey = process.env.SUPABASE_STAGING_SECRET_KEY;
const admin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});
const owner = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

const runId = randomUUID().slice(0, 8);
const idempotencyKey = randomUUID();
const email = `owner-invite-${runId}@mise-staging.test`;
const restaurantName = `Owner Invite ${runId} ${process.env.MISE_STAGING_MARKER}`
  .slice(0, 120)
  .trim();
const password = `Beta-${randomUUID()}-9`;
const tempDirectory = await mkdtemp(join(tmpdir(), "mise-owner-invite-proof-"));
const inviteFile = join(tempDirectory, "owner-invite.json");
const state = {
  userId: null,
  restaurantId: null
};

try {
  const sentinel = await loadSentinel();
  const command = await exec(
    process.execPath,
    [
      join(process.cwd(), "scripts/beta-restaurant-provisioning.mjs"),
      "--apply",
      "--email",
      email,
      "--restaurant",
      restaurantName,
      "--cuisine",
      "Disposable invitation proof",
      "--idempotency-key",
      idempotencyKey,
      "--invite-file",
      inviteFile,
      "--confirm-project-ref",
      process.env.SUPABASE_STAGING_PROJECT_REF
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: 2 * 1024 * 1024,
      timeout: 60_000
    }
  );
  assert.equal(command.stderr.trim(), "", "Provisioning must not emit raw provider output.");
  const summary = JSON.parse(command.stdout);
  assert.equal(summary.status, "provisioned");
  assert.equal(summary.inviteArtifactCreated, true);
  assert.equal(summary.providersEnabled, false);
  assert.equal(summary.orderingPolicy, "off");
  state.restaurantId = summary.restaurantId;

  const inviteStats = await stat(inviteFile);
  assert.equal(inviteStats.mode & 0o077, 0, "Invitation artifact must be owner-only.");
  const artifact = JSON.parse(await readFile(inviteFile, "utf8"));
  assert.equal(artifact.kind, "mise_beta_owner_invitation");
  assert.equal(artifact.email, email);
  assert.equal(artifact.restaurantName, restaurantName);
  assert.equal(artifact.redirectTo, "mise://accept-invite");
  assert.ok(typeof artifact.actionLink === "string" && artifact.actionLink.length > 0);

  const verifyResponse = await fetch(artifact.actionLink, {
    redirect: "manual"
  });
  assert.ok(
    verifyResponse.status >= 300 && verifyResponse.status < 400,
    "Invitation verification must redirect to the app callback."
  );
  const callbackUrl = verifyResponse.headers.get("location") ?? "";
  const callback = parseInviteCallbackUrl(callbackUrl);
  assert.notEqual(typeof callback, "string", "Hosted Auth must return a complete Mise invite callback.");
  if (typeof callback === "string") throw new Error("Hosted Auth returned no invite session.");

  const session = await owner.auth.setSession({
    access_token: callback.accessToken,
    refresh_token: callback.refreshToken
  });
  if (session.error || !session.data.user) {
    throw session.error ?? new Error("Invitation session was not accepted.");
  }
  state.userId = session.data.user.id;
  assert.equal(session.data.user.email, email);

  const passwordUpdate = await owner.auth.updateUser({ password });
  if (passwordUpdate.error) throw passwordUpdate.error;
  assert.equal(passwordUpdate.data.user.id, state.userId);

  const membership = await owner
    .from("restaurant_memberships")
    .select("restaurant_id,user_id,role,status")
    .eq("restaurant_id", state.restaurantId)
    .eq("user_id", state.userId)
    .single();
  if (membership.error) throw membership.error;
  assert.equal(membership.data.role, "owner");
  assert.equal(membership.data.status, "active");

  await owner.auth.signOut();
  const signedIn = await owner.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  assert.equal(signedIn.data.user.id, state.userId);

  const replay = await exec(
    process.execPath,
    [
      join(process.cwd(), "scripts/beta-restaurant-provisioning.mjs"),
      "--apply",
      "--email",
      email,
      "--restaurant",
      restaurantName,
      "--cuisine",
      "Disposable invitation proof",
      "--idempotency-key",
      idempotencyKey,
      "--confirm-project-ref",
      process.env.SUPABASE_STAGING_PROJECT_REF
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: 2 * 1024 * 1024,
      timeout: 60_000
    }
  );
  const replaySummary = JSON.parse(replay.stdout);
  assert.equal(replaySummary.restaurantId, state.restaurantId);
  assert.equal(replaySummary.inviteArtifactCreated, false);
  assert.equal(replaySummary.replaySafe, true);

  assert.deepEqual(await loadSentinel(), sentinel);
  console.log(
    `Mise hosted owner-invitation proof passed: one protected link accepted, credential sign-in succeeded, service provisioning replayed without a duplicate, and sentinel tenant remained unchanged.`
  );
} finally {
  await owner.auth.signOut().catch(() => undefined);
  if (state.restaurantId) {
    const target = await admin
      .from("restaurants")
      .select("id,name")
      .eq("id", state.restaurantId)
      .maybeSingle();
    if (!target.error && target.data?.name === restaurantName) {
      await admin.from("restaurants").delete().eq("id", state.restaurantId);
    }
  }
  if (state.userId) {
    const target = await admin.auth.admin.getUserById(state.userId);
    if (!target.error && target.data.user?.email === email) {
      await admin.auth.admin.deleteUser(state.userId);
    }
  } else {
    const matches = await findUsersByEmail(email);
    for (const user of matches) await admin.auth.admin.deleteUser(user.id);
  }
  await rm(tempDirectory, { recursive: true, force: true });
}

async function findUsersByEmail(targetEmail) {
  const matches = [];
  for (let page = 1; page <= 100; page += 1) {
    const response = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (response.error) throw response.error;
    matches.push(
      ...response.data.users.filter(
        (user) => user.email?.trim().toLowerCase() === targetEmail.toLowerCase()
      )
    );
    if (response.data.users.length < 1000) return matches;
  }
  throw new Error("Auth user cleanup exceeded its bounded page limit.");
}

async function loadSentinel() {
  const result = await admin
    .from("restaurants")
    .select("id,name,created_at")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (result.error || !result.data) {
    throw result.error ?? new Error("No staging sentinel tenant exists.");
  }
  return result.data;
}

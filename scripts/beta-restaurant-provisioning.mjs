import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chmod, open, stat, unlink } from "node:fs/promises";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

import { assertStagingPreflight } from "./staging-preflight.mjs";
import {
  assertInviteArtifactOutsideWorkspace,
  assertProvisioningEnvironment,
  executeBetaRestaurantProvisioning,
  maskProvisioningEmail,
  normalizeProvisioningRequest
} from "./lib/betaRestaurantProvisioning.mjs";

const { values } = parseArgs({
  options: {
    apply: { type: "boolean", default: false },
    email: { type: "string" },
    restaurant: { type: "string" },
    cuisine: { type: "string", default: "" },
    "idempotency-key": { type: "string" },
    "invite-file": { type: "string", default: "" },
    "redirect-to": { type: "string", default: "mise://accept-invite" },
    "confirm-project-ref": { type: "string", default: "" },
    help: { type: "boolean", default: false }
  },
  strict: true,
  allowPositionals: false
});

if (values.help) {
  console.log(`Mise beta owner provisioning

Dry-run (default):
  npm run beta:provision-owner -- \\
    --email owner@example.com \\
    --restaurant "Example Restaurant" \\
    --cuisine "Fast casual" \\
    --idempotency-key ${randomUUID()} \\
    --invite-file /private/tmp/mise-owner-invite.json

Apply to hosted staging only:
  Add --apply --confirm-project-ref <staging-project-ref>

The invitation file contains a one-time Auth link, is created with mode 0600,
must live outside this repository, and is never printed. Existing Auth users
are provisioned idempotently without generating or replacing an invite file.`);
  process.exit(0);
}

const request = normalizeProvisioningRequest({
  email: values.email,
  restaurantName: values.restaurant,
  cuisineType: values.cuisine,
  idempotencyKey: values["idempotency-key"],
  inviteFile: values["invite-file"],
  redirectTo: values["redirect-to"]
});
assertInviteArtifactOutsideWorkspace(request.inviteFile, process.cwd());

if (!values.apply) {
  console.log(
    JSON.stringify(
      {
        mode: "dry_run",
        target: "hosted_staging_only",
        owner: maskProvisioningEmail(request.email),
        restaurantName: request.restaurantName,
        cuisineType: request.cuisineType || null,
        idempotencyKey: request.idempotencyKey,
        redirectTo: request.redirectTo,
        inviteArtifact: request.inviteFile ? "reserved_on_apply_for_new_user" : "not_configured",
        mutations: 0
      },
      null,
      2
    )
  );
  process.exit(0);
}

const applyRequest = {
  ...request,
  confirmProjectRef: values["confirm-project-ref"]
};
assertProvisioningEnvironment(applyRequest, process.env);
await assertStagingPreflight();
await assertInviteOnlyAuth();

const admin = createClient(
  process.env.SUPABASE_STAGING_URL,
  process.env.SUPABASE_STAGING_SECRET_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  }
);
const reservedArtifacts = new Map();

try {
  const result = await executeBetaRestaurantProvisioning(applyRequest, {
    findUsersByEmail,
    reserveInviteArtifact,
    generateInvite,
    writeInviteArtifact,
    removeInviteArtifact,
    deleteNewUser,
    provisionRestaurant,
    verifyProvisioning
  });
  console.log(
    JSON.stringify(
      {
        status: "provisioned",
        projectRef: process.env.SUPABASE_STAGING_PROJECT_REF,
        owner: result.ownerEmailMasked,
        restaurantId: result.restaurantId,
        inviteArtifactCreated: result.inviteArtifactCreated,
        providersEnabled: false,
        orderingPolicy: "off",
        replaySafe: true
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(`Mise beta owner provisioning failed: ${safeErrorMessage(error)}`);
  process.exitCode = 1;
} finally {
  for (const handle of reservedArtifacts.values()) {
    await handle.close().catch(() => undefined);
  }
}

async function assertInviteOnlyAuth() {
  const response = await fetch(`${process.env.SUPABASE_STAGING_URL}/auth/v1/settings`, {
    headers: { apikey: process.env.SUPABASE_STAGING_ANON_KEY }
  });
  assert.equal(response.ok, true, "Hosted Auth settings must be readable.");
  const settings = await response.json();
  assert.equal(settings.disable_signup, true, "Public signup must remain disabled.");
  assert.equal(settings.external?.email, true, "Invited-user email login must remain enabled.");
  assert.equal(settings.external?.anonymous_users, false, "Anonymous admission must remain disabled.");
}

async function findUsersByEmail(email) {
  const matches = [];
  for (let page = 1; page <= 100; page += 1) {
    const response = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (response.error) throw response.error;
    matches.push(
      ...response.data.users.filter((user) => user.email?.trim().toLowerCase() === email)
    );
    if (response.data.users.length < 1000) return matches;
  }
  throw new Error("Auth user lookup exceeded its bounded page limit.");
}

async function reserveInviteArtifact(path) {
  const handle = await open(path, "wx", 0o600);
  reservedArtifacts.set(path, handle);
}

async function generateInvite({ email, redirectTo }) {
  const response = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo }
  });
  if (response.error || !response.data.user || !response.data.properties?.action_link) {
    throw response.error ?? new Error("Auth administration returned no invitation.");
  }
  return {
    userId: response.data.user.id,
    actionLink: response.data.properties.action_link
  };
}

async function writeInviteArtifact(path, artifact) {
  const handle = reservedArtifacts.get(path);
  if (!handle) throw new Error("Invitation artifact was not reserved.");
  await handle.writeFile(`${JSON.stringify(artifact, null, 2)}\n`, { encoding: "utf8" });
  await handle.sync();
  await handle.close();
  reservedArtifacts.delete(path);
  await chmod(path, 0o600);
  const file = await stat(path);
  assert.equal(file.mode & 0o077, 0, "Invitation artifact permissions must remain owner-only.");
}

async function removeInviteArtifact(path) {
  const handle = reservedArtifacts.get(path);
  if (handle) {
    await handle.close();
    reservedArtifacts.delete(path);
  }
  await unlink(path);
}

async function deleteNewUser(userId) {
  const response = await admin.auth.admin.deleteUser(userId);
  if (response.error) throw response.error;
}

async function provisionRestaurant({
  ownerUserId,
  restaurantName,
  cuisineType,
  idempotencyKey
}) {
  const response = await admin.rpc("service_provision_beta_restaurant", {
    p_owner_user_id: ownerUserId,
    p_restaurant_name: restaurantName,
    p_restaurant_cuisine_type: cuisineType || null,
    p_idempotency_key: idempotencyKey
  });
  if (response.error || !response.data?.id) {
    throw response.error ?? new Error("Restaurant provisioning returned no authority.");
  }
  return response.data;
}

async function verifyProvisioning({ userId, restaurantId }) {
  const [membership, controls] = await Promise.all([
    admin
      .from("restaurant_memberships")
      .select("restaurant_id,user_id,role,status")
      .eq("restaurant_id", restaurantId)
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("restaurant_operational_controls")
      .select(
        "square_sync_enabled,square_webhooks_enabled,gmail_delivery_enabled,insight_generation_enabled,order_drafting_enabled,stripe_invoicing_enabled,ordering_policy"
      )
      .eq("restaurant_id", restaurantId)
      .maybeSingle()
  ]);
  if (membership.error || !membership.data) {
    throw membership.error ?? new Error("Provisioned owner membership is missing.");
  }
  if (controls.error || !controls.data) {
    throw controls.error ?? new Error("Provisioned restaurant controls are missing.");
  }
  assert.equal(membership.data.role, "owner");
  assert.equal(membership.data.status, "active");
  for (const name of [
    "square_sync_enabled",
    "square_webhooks_enabled",
    "gmail_delivery_enabled",
    "insight_generation_enabled",
    "order_drafting_enabled",
    "stripe_invoicing_enabled"
  ]) {
    assert.equal(controls.data[name], false, `${name} must remain disabled.`);
  }
  assert.equal(controls.data.ordering_policy, "off");
}

function safeErrorMessage(error) {
  const message = error instanceof Error ? error.message : "Unknown provisioning failure.";
  return message
    .replace(/https?:\/\/\S+/gi, "<redacted-url>")
    .replace(/(?:access|refresh|service|secret)[_-]?(?:token|key)\s*[:=]\s*\S+/gi, "<redacted>")
    .slice(0, 500);
}

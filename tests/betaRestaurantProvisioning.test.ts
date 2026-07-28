import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  assertInviteArtifactOutsideWorkspace,
  assertProvisioningEnvironment,
  executeBetaRestaurantProvisioning,
  maskProvisioningEmail,
  normalizeProvisioningRequest
} from "../scripts/lib/betaRestaurantProvisioning.mjs";

const operatorScript = readFileSync("scripts/beta-restaurant-provisioning.mjs", "utf8");

function request(overrides: Record<string, unknown> = {}) {
  return normalizeProvisioningRequest({
    email: " Owner@Example.com ",
    restaurantName: " Example Kitchen ",
    cuisineType: " Cafe ",
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
    redirectTo: "mise://accept-invite",
    inviteFile: "/private/tmp/mise-beta-invite.json",
    ...overrides
  });
}

function operations(overrides: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const value = {
    calls,
    findUsersByEmail: async () => [],
    reserveInviteArtifact: async () => {
      calls.push("reserve");
    },
    generateInvite: async () => {
      calls.push("generate");
      return { userId: "user-1", actionLink: "https://auth.example/invite?token=secret" };
    },
    writeInviteArtifact: async () => {
      calls.push("write");
    },
    removeInviteArtifact: async () => {
      calls.push("remove");
    },
    deleteNewUser: async () => {
      calls.push("delete-user");
    },
    provisionRestaurant: async () => {
      calls.push("provision");
      return { id: "restaurant-1" };
    },
    verifyProvisioning: async () => {
      calls.push("verify");
    },
    ...overrides
  };
  return value;
}

test("beta provisioning input is normalized, bounded, and staging-pinned", () => {
  const normalized = request();
  assert.equal(normalized.email, "owner@example.com");
  assert.equal(normalized.restaurantName, "Example Kitchen");
  assert.equal(normalized.cuisineType, "Cafe");
  assert.equal(maskProvisioningEmail(normalized.email), "o***@example.com");

  assert.throws(() => request({ email: "invalid" }), /valid owner email/);
  assert.throws(() => request({ restaurantName: "" }), /Restaurant name/);
  assert.throws(() => request({ cuisineType: "x".repeat(121) }), /Cuisine type/);
  assert.throws(() => request({ idempotencyKey: "new-every-time" }), /RFC 4122/);
  assert.throws(() => request({ redirectTo: "https://evil.example" }), /mise:\/\/accept-invite/);
  assert.throws(() => request({ inviteFile: "relative.json" }), /must be absolute/);
  assert.throws(
    () => assertInviteArtifactOutsideWorkspace("/workspace/private.json", "/workspace"),
    /outside the repository/
  );

  assert.doesNotThrow(() =>
    assertProvisioningEnvironment(
      { confirmProjectRef: "staging-ref" },
      {
        SUPABASE_STAGING_PROJECT_REF: "staging-ref",
        SUPABASE_PRODUCTION_PROJECT_REF: "production-ref",
        SUPABASE_STAGING_URL: "https://staging.example",
        SUPABASE_STAGING_SECRET_KEY: "secret",
        SUPABASE_STAGING_ANON_KEY: "public"
      }
    )
  );
  assert.throws(
    () =>
      assertProvisioningEnvironment(
        { confirmProjectRef: "production-ref" },
        {
          SUPABASE_STAGING_PROJECT_REF: "production-ref",
          SUPABASE_PRODUCTION_PROJECT_REF: "production-ref",
          SUPABASE_STAGING_URL: "https://production.example",
          SUPABASE_STAGING_SECRET_KEY: "secret",
          SUPABASE_STAGING_ANON_KEY: "public"
        }
      ),
    /production project/
  );
});

test("a new owner receives one protected invite before replay-safe tenant provisioning", async () => {
  const ops = operations();
  const result = await executeBetaRestaurantProvisioning(request(), ops);
  assert.deepEqual(ops.calls, ["reserve", "generate", "write", "provision", "verify"]);
  assert.deepEqual(result, {
    userId: "user-1",
    restaurantId: "restaurant-1",
    ownerEmailMasked: "o***@example.com",
    inviteArtifactCreated: true,
    replaySafe: true
  });
  assert.equal(JSON.stringify(result).includes("token=secret"), false);
});

test("an existing Auth owner replays without generating or replacing an invite", async () => {
  const ops = operations({
    findUsersByEmail: async () => [{ id: "existing-user", email: "owner@example.com" }]
  });
  const result = await executeBetaRestaurantProvisioning(
    request({ inviteFile: "" }),
    ops
  );
  assert.deepEqual(ops.calls, ["provision", "verify"]);
  assert.equal(result.userId, "existing-user");
  assert.equal(result.inviteArtifactCreated, false);
});

test("a pre-acceptance provisioning failure removes the invite artifact and new Auth user", async () => {
  const ops = operations({
    provisionRestaurant: async () => {
      ops.calls.push("provision");
      throw new Error("database unavailable");
    }
  });
  await assert.rejects(
    executeBetaRestaurantProvisioning(request(), ops),
    /database unavailable/
  );
  assert.deepEqual(ops.calls, [
    "reserve",
    "generate",
    "write",
    "provision",
    "remove",
    "delete-user"
  ]);
});

test("accepted provisioning is preserved when final verification needs reconciliation", async () => {
  const ops = operations({
    verifyProvisioning: async () => {
      ops.calls.push("verify");
      throw new Error("read timed out");
    }
  });
  await assert.rejects(
    executeBetaRestaurantProvisioning(request(), ops),
    /preserve the tenant and reconcile manually/
  );
  assert.deepEqual(ops.calls, ["reserve", "generate", "write", "provision", "verify"]);
});

test("the operator command never prints invitation credentials or bypasses staging safety", () => {
  assert.match(operatorScript, /assertStagingPreflight\(\)/);
  assert.match(operatorScript, /settings\.disable_signup,\s*true/);
  assert.match(operatorScript, /settings\.external\?\.email,\s*true/);
  assert.match(operatorScript, /open\(path,\s*"wx",\s*0o600\)/);
  assert.match(operatorScript, /service_provision_beta_restaurant/);
  assert.doesNotMatch(operatorScript, /console\.(?:log|error)\([^)]*actionLink/);
  assert.doesNotMatch(operatorScript, /console\.(?:log|error)\([^)]*(?:secretKey|accessToken|refreshToken)/);
});

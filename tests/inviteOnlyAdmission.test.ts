import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const login = readFileSync("app/(auth)/login.tsx", "utf8");
const setup = readFileSync("app/(auth)/setup.tsx", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");
const localConfig = readFileSync("supabase/config.toml", "utf8");
const stagingConfig = readFileSync(
  "supabase/environments/staging/supabase/config.toml",
  "utf8"
);
const migration = readFileSync(
  "supabase/migrations/20260728210609_enforce_invite_only_beta_admission.sql",
  "utf8"
);
const localConcurrency = readFileSync("scripts/local-workspace-concurrency.mjs", "utf8");
const stagingAccountDeletion = readFileSync("scripts/staging-account-deletion-check.mjs", "utf8");
const stagingLearning = readFileSync("scripts/staging-learning-check.mjs", "utf8");
const sessionContext = readFileSync("contexts/MiseSessionContext.tsx", "utf8");
const accountApplication = readFileSync("services/application/account.ts", "utf8");

test("beta login is sign-in-only while preserving bounded demo and public help access", () => {
  assert.doesNotMatch(login, /\bsignUp\b/);
  assert.doesNotMatch(login, /AuthMode|confirmationEmail|confirmPassword/);
  assert.match(login, /await signIn\(normalizedEmail, password\)/);
  assert.match(login, /signInWithProvider/);
  assert.match(login, /login\.action\.google/);
  assert.match(login, /login\.action\.apple/);
  assert.match(login, /canUseDemoMode\s*\?/);
  assert.match(login, /router\.push\("\/settings\/privacy"/);
  assert.match(login, /router\.push\("\/settings\/support"/);
  assert.match(login, /login\.invite\.supportHint/);
  assert.match(catalog, /This August 3 beta is invite-only/);
});

test("session exposes OAuth provider sign-in without opening self-serve signup", () => {
  assert.match(sessionContext, /signInWithProvider/);
  assert.match(sessionContext, /signInWithOAuthProvider/);
  assert.doesNotMatch(sessionContext, /\bsignUp\s*:/);
  assert.doesNotMatch(sessionContext, /supabase\.auth\.signUp/);
});

test("hosted users without a restaurant fail closed before setup", () => {
  assert.doesNotMatch(setup, /\bcreateRestaurant\b/);
  assert.match(setup, /authUser && !isDemoSetup && !hasActiveMembership/);
  assert.match(setup, /setup\.access\.pendingTitle/);
  assert.match(setup, /await signOut\(\)/);
  assert.match(setup, /const isDemoSetup = canUseDemoMode/);
});

test("the application removes dead self-service account and tenant allocation APIs", () => {
  assert.doesNotMatch(sessionContext, /\bsignUp\s*:/);
  assert.doesNotMatch(sessionContext, /supabase\.auth\.signUp/);
  assert.doesNotMatch(sessionContext, /\bcreateRestaurant\s*:/);
  assert.doesNotMatch(sessionContext, /createRestaurantWithOwner/);
});

test("invite acceptance sets one bounded session and clears partial password failures", () => {
  assert.match(accountApplication, /parseInviteCallbackUrl/);
  assert.match(accountApplication, /supabase\.auth\.setSession/);
  assert.match(accountApplication, /supabase\.auth\.updateUser\(\{\s*password\s*\}\)/);
  assert.match(
    accountApplication,
    /updated\.error[\s\S]*supabase\.auth\.signOut\(\{\s*scope:\s*"local"\s*\}\)/
  );
  assert.doesNotMatch(accountApplication, /console\.(?:log|error)/);
});

test("local and hosted Auth policy disables registration without disabling email login", () => {
  for (const config of [localConfig, stagingConfig]) {
    assert.match(config, /\[auth\][\s\S]*?enable_signup\s*=\s*false[\s\S]*?\[auth\.email\]/);
    assert.match(config, /\[auth\.email\][\s\S]*?enable_signup\s*=\s*true/);
  }
  assert.match(stagingAccountDeletion, /settings\.disable_signup,\s*true/);
  assert.match(stagingAccountDeletion, /settings\.external\?\.email,\s*true/);
  assert.match(stagingAccountDeletion, /signupResponse\.status,\s*422/);
});

test("database admission is service-only, replay-safe, and default-off", () => {
  assert.match(
    migration,
    /revoke all on function public\.create_restaurant_with_owner\(text, text\)[\s\S]*authenticated[\s\S]*service_role/i
  );
  assert.match(
    migration,
    /grant execute on function public\.service_provision_beta_restaurant\(uuid, text, text, uuid\)[\s\S]*to service_role/i
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.service_provision_beta_restaurant\(uuid, text, text, uuid\)[\s\S]*to authenticated/i
  );
  assert.match(migration, /beta_restaurant_provisioning_requests/);
  assert.match(migration, /p_idempotency_key/);
  assert.match(migration, /Owner Auth user does not exist/);
  assert.match(migration, /controls\.square_sync_enabled/);
  assert.match(migration, /controls\.gmail_delivery_enabled/);
  assert.match(migration, /controls\.stripe_invoicing_enabled/);
  assert.match(migration, /controls\.ordering_policy <> 'off'/);
});

test("local and hosted operational proofs use only admin provisioning", () => {
  assert.match(localConcurrency, /service_provision_beta_restaurant/);
  assert.doesNotMatch(localConcurrency, /public\.create_restaurant_with_owner/);
  assert.match(stagingLearning, /admin\.rpc\("service_provision_beta_restaurant"/);
  assert.match(stagingAccountDeletion, /admin\.rpc\("service_provision_beta_restaurant"/);
  assert.match(
    stagingAccountDeletion,
    /owner\.rpc\("create_restaurant_with_owner"[\s\S]*unauthorizedAllocation\.error/
  );
});

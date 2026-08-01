import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

import {
  isDuplicateAuthIdentity,
  isValidSignupEmail,
  normalizeSignupEmail,
  resolvePostAuthPath,
  SIGNUP_PATH,
  validateSignupPassword
} from "../services/domain/authSignup.ts";
import { generateInviteToken } from "../services/domain/teamInvites.ts";

test("signup email and password rules reuse recovery validation", () => {
  assert.equal(normalizeSignupEmail("  Teammate@Demo.Mise "), "teammate@demo.mise");
  assert.equal(isValidSignupEmail("teammate@demo.mise"), true);
  assert.equal(isValidSignupEmail("bad"), false);
  assert.equal(validateSignupPassword("securePass1"), null);
  assert.match(validateSignupPassword("short") ?? "", /at least 8/i);
});

test("duplicate auth identity detection matches Supabase empty-identities signal", () => {
  assert.equal(isDuplicateAuthIdentity({ identities: [] }), true);
  assert.equal(isDuplicateAuthIdentity({ identities: [{ id: "1" }] }), false);
  assert.equal(isDuplicateAuthIdentity(null), false);
});

test("post-auth path prefers pending invite claim over setup home", () => {
  const token = generateInviteToken();
  assert.equal(
    resolvePostAuthPath({ pendingInviteToken: token, hasRestaurant: false }),
    `/invite/${token}`
  );
  assert.equal(resolvePostAuthPath({ pendingInviteToken: null, hasRestaurant: true }), "/today");
  assert.equal(resolvePostAuthPath({ pendingInviteToken: null, hasRestaurant: false }), "/");
  assert.equal(SIGNUP_PATH, "/signup");
});

test("signup and invite claim wiring expose create-account path", () => {
  const signup = readFileSync("app/(auth)/signup.tsx", "utf8");
  const login = readFileSync("app/(auth)/login.tsx", "utf8");
  const invite = readFileSync("app/invite/[token].tsx", "utf8");
  const session = readFileSync("contexts/MiseSessionContext.tsx", "utf8");
  const routes = readFileSync("scripts/mobile-route-smoke.mjs", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");

  assert.match(session, /signUp:\s*\(email:\s*string,\s*password:\s*string\)/);
  assert.match(session, /supabase\.auth\.signUp/);
  assert.match(session, /readPendingInviteToken/);
  assert.match(session, /emailRedirectTo/);
  assert.match(signup, /signUp\(/);
  assert.match(signup, /resolvePostAuthPath/);
  assert.match(login, /login\.action\.createAccount/);
  assert.match(login, /router\.replace\("\/signup"\)/);
  assert.match(login, /resolvePostAuthPath/);
  assert.match(invite, /invite\.claim\.createAccount/);
  assert.match(invite, /router\.replace\("\/signup"\)/);
  assert.match(invite, /autoClaimStarted/);
  assert.match(routes, /\/signup/);
  assert.match(catalog, /"signup\.title"/);
  assert.match(catalog, /"invite\.claim\.createAccount"/);
});

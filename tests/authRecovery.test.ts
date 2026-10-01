import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

import {
  extractAuthCallbackParams,
  isAuthSessionCallback,
  isPasswordRecoveryAuthEvent,
  isRecoveryCallback,
  isValidRecoveryEmail,
  normalizeRecoveryEmail,
  PASSWORD_RESET_PATH,
  validateNewPassword
} from "../services/domain/authRecovery.ts";

test("recovery email normalization matches account email rules", () => {
  assert.equal(normalizeRecoveryEmail("  Owner@Demo.Mise "), "owner@demo.mise");
  assert.equal(isValidRecoveryEmail("owner@demo.mise"), true);
  assert.equal(isValidRecoveryEmail("not-an-email"), false);
});

test("new password validation enforces length and rejects spaces", () => {
  assert.equal(validateNewPassword(""), "Password is required.");
  assert.match(validateNewPassword("short") ?? "", /at least 8/i);
  assert.match(validateNewPassword("a".repeat(73)) ?? "", /at most 72/i);
  assert.match(validateNewPassword("bad pass1") ?? "", /spaces/i);
  assert.equal(validateNewPassword("securePass1"), null);
});

test("auth callback parsing supports PKCE code and recovery hash tokens", () => {
  const resetUrl = "mise://reset-password?code=abc123";
  const codeParams = extractAuthCallbackParams(resetUrl);
  assert.equal(codeParams.code, "abc123");
  assert.equal(isAuthSessionCallback(codeParams), true);
  assert.equal(isRecoveryCallback(codeParams, resetUrl), true);

  const recoveryHashUrl = "mise://reset-password#access_token=tok&refresh_token=ref&type=recovery";
  const hashParams = extractAuthCallbackParams(recoveryHashUrl);
  assert.equal(hashParams.accessToken, "tok");
  assert.equal(hashParams.refreshToken, "ref");
  assert.equal(hashParams.type, "recovery");
  assert.equal(isAuthSessionCallback(hashParams), true);
  assert.equal(isRecoveryCallback(hashParams, recoveryHashUrl), true);
  assert.equal(isPasswordRecoveryAuthEvent("PASSWORD_RECOVERY"), true);
  assert.equal(isPasswordRecoveryAuthEvent("SIGNED_IN"), false);
  assert.equal(PASSWORD_RESET_PATH, "/reset-password");
});

test("signup and invite PKCE codes exchange session without marking password recovery", () => {
  const signupUrl = "mise://?code=signup-code";
  const signupParams = extractAuthCallbackParams(signupUrl);
  assert.equal(isAuthSessionCallback(signupParams), true);
  assert.equal(isRecoveryCallback(signupParams, signupUrl), false);

  const inviteUrl = "mise://invite/abc?code=invite-code";
  const inviteParams = extractAuthCallbackParams(inviteUrl);
  assert.equal(isAuthSessionCallback(inviteParams), true);
  assert.equal(isRecoveryCallback(inviteParams, inviteUrl), false);

  const typedSignupUrl = "mise://login?code=confirm&type=signup";
  const typedSignupParams = extractAuthCallbackParams(typedSignupUrl);
  assert.equal(isAuthSessionCallback(typedSignupParams), true);
  assert.equal(isRecoveryCallback(typedSignupParams, typedSignupUrl), false);

  const recoveryTypedElsewhere = extractAuthCallbackParams(
    "mise://today#access_token=tok&refresh_token=ref&type=recovery"
  );
  assert.equal(
    isRecoveryCallback(
      recoveryTypedElsewhere,
      "mise://today#access_token=tok&refresh_token=ref&type=recovery"
    ),
    true
  );
});

test("password reset UI and session wiring are present", () => {
  const login = readFileSync("app/(auth)/login.tsx", "utf8");
  const reset = readFileSync("app/(auth)/reset-password.tsx", "utf8");
  const session = readFileSync("contexts/MiseSessionContext.tsx", "utf8");
  const routes = readFileSync("scripts/mobile-route-smoke.mjs", "utf8");
  const supabase = readFileSync("lib/supabase.ts", "utf8");
  const config = readFileSync("supabase/config.toml", "utf8");

  assert.match(login, /requestPasswordReset/);
  assert.match(login, /login\.action\.forgotPassword/);
  assert.match(reset, /completePasswordReset/);
  assert.match(session, /PASSWORD_RECOVERY/);
  assert.match(session, /exchangeCodeForSession/);
  assert.match(session, /requestPasswordReset/);
  assert.match(session, /completePasswordReset/);
  assert.match(supabase, /flowType:\s*["']pkce["']/);
  assert.match(routes, /\/reset-password/);
  assert.match(config, /mise:\/\/reset-password/);
});

test("failed recovery deep links surface a login StatusNotice instead of silent bounce", () => {
  const session = readFileSync("contexts/MiseSessionContext.tsx", "utf8");
  const login = readFileSync("app/(auth)/login.tsx", "utf8");
  const reset = readFileSync("app/(auth)/reset-password.tsx", "utf8");

  assert.match(session, /passwordRecoveryLinkError/);
  assert.match(session, /clearPasswordRecoveryLinkError/);
  assert.match(
    session,
    /captureMiseError\(callbackError[\s\S]*password_recovery[\s\S]*auth_callback[\s\S]*setPasswordRecoveryLinkError\(true\)/
  );
  assert.match(session, /setPasswordRecoveryLinkError\(false\)/);
  assert.match(login, /passwordRecoveryLinkError/);
  assert.match(login, /resetLinkInvalid/);
  assert.match(login, /clearPasswordRecoveryLinkError/);
  assert.match(reset, /passwordRecoveryLinkError/);
});

test("auth callback exchange scopes password recovery to recovery callbacks only", () => {
  const session = readFileSync("contexts/MiseSessionContext.tsx", "utf8");
  const domain = readFileSync("services/domain/authRecovery.ts", "utf8");

  assert.match(domain, /export function isAuthSessionCallback/);
  assert.match(session, /isRecoveryCallback\(params,\s*url\)/);
  assert.match(session, /markPasswordRecovery\(\)/);
  assert.doesNotMatch(
    session,
    /if \(params\.type === "recovery" \|\| params\.code \|\| \(params\.accessToken && params\.refreshToken\)\)/
  );
});

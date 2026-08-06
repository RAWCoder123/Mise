#!/usr/bin/env node
/**
 * Enable Google + Apple Auth providers on a hosted Supabase project via the
 * Management API, and refresh the redirect allow-list for Expo app/web.
 *
 * Required env (never commit values):
 *   SUPABASE_ACCESS_TOKEN          — personal access token from supabase.com/dashboard/account/tokens
 *   SUPABASE_STAGING_PROJECT_REF   — project ref (or pass --project-ref)
 *   SUPABASE_AUTH_GOOGLE_CLIENT_ID
 *   SUPABASE_AUTH_GOOGLE_SECRET
 *
 * Optional:
 *   SUPABASE_AUTH_APPLE_CLIENT_ID  — Services ID
 *   SUPABASE_AUTH_APPLE_SECRET     — generated Apple client secret JWT
 *   SUPABASE_STAGING_URL           — used only for post-check
 *   SUPABASE_STAGING_ANON_KEY      — used only for post-check
 *
 * Usage:
 *   node --env-file-if-exists=.mise-staging.env --env-file-if-exists=.mise-auth-oauth.env \
 *     scripts/enable-social-auth.mjs
 *   node scripts/enable-social-auth.mjs --project-ref <ref> --dry-run
 */

import assert from "node:assert/strict";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const projectRefFlagIndex = process.argv.indexOf("--project-ref");
const projectRef =
  (projectRefFlagIndex >= 0 ? process.argv[projectRefFlagIndex + 1] : null) ||
  process.env.SUPABASE_STAGING_PROJECT_REF ||
  process.env.SUPABASE_PROJECT_REF;

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const googleClientId = process.env.SUPABASE_AUTH_GOOGLE_CLIENT_ID || process.env.GOOGLE_AUTH_CLIENT_ID;
const googleSecret = process.env.SUPABASE_AUTH_GOOGLE_SECRET || process.env.GOOGLE_AUTH_CLIENT_SECRET;
const appleClientId = process.env.SUPABASE_AUTH_APPLE_CLIENT_ID || process.env.APPLE_AUTH_CLIENT_ID;
const appleSecret = process.env.SUPABASE_AUTH_APPLE_SECRET || process.env.APPLE_AUTH_CLIENT_SECRET;

const redirectUrls = [
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:8081/auth/callback",
  "http://127.0.0.1:8081/auth/callback",
  "mise://accept-invite",
  "mise://auth/callback"
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!projectRef) fail("Missing project ref. Set SUPABASE_STAGING_PROJECT_REF or pass --project-ref.");
if (!accessToken) {
  fail(
    "Missing SUPABASE_ACCESS_TOKEN. Create one at https://supabase.com/dashboard/account/tokens and export it (or add to .mise-auth-oauth.env)."
  );
}
if (!googleClientId || !googleSecret) {
  fail(
    "Missing Google Auth client credentials. Set SUPABASE_AUTH_GOOGLE_CLIENT_ID and SUPABASE_AUTH_GOOGLE_SECRET."
  );
}

const body = {
  external_google_enabled: true,
  external_google_client_id: googleClientId,
  external_google_secret: googleSecret,
  // Invite-only: keep global signup disabled; existing provisioned emails can still OAuth.
  disable_signup: true,
  external_email_enabled: true,
  uri_allow_list: redirectUrls.join(","),
  site_url: process.env.SUPABASE_AUTH_SITE_URL || "http://localhost:8081",
  // Allow operators to link Google/Apple onto an invited email account after first password login if needed.
  security_manual_linking_enabled: true
};

const enableApple = Boolean(appleClientId && appleSecret);
if (enableApple) {
  body.external_apple_enabled = true;
  body.external_apple_client_id = appleClientId;
  body.external_apple_secret = appleSecret;
} else if (appleClientId || appleSecret) {
  fail("Apple Auth requires both SUPABASE_AUTH_APPLE_CLIENT_ID and SUPABASE_AUTH_APPLE_SECRET.");
} else {
  console.warn("Apple credentials not set — enabling Google only. Re-run later with Apple Services ID + secret JWT.");
}

console.log(
  JSON.stringify(
    {
      projectRef,
      dryRun,
      googleEnabled: true,
      appleEnabled: enableApple,
      redirectUrls,
      disableSignup: true
    },
    null,
    2
  )
);

if (dryRun) {
  console.log("Dry run only — no Management API write.");
  process.exit(0);
}

const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify(body)
});

const payload = await response.text();
if (!response.ok) {
  fail(`Management API PATCH failed (${response.status}): ${payload.slice(0, 2000)}`);
}

console.log(`Auth config updated for ${projectRef}.`);

const stagingUrl = process.env.SUPABASE_STAGING_URL;
const anonKey = process.env.SUPABASE_STAGING_ANON_KEY;
if (stagingUrl && anonKey && projectRef === process.env.SUPABASE_STAGING_PROJECT_REF) {
  const settingsResponse = await fetch(`${stagingUrl}/auth/v1/settings`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`
    }
  });
  assert.equal(settingsResponse.status, 200, "auth settings probe failed");
  const settings = await settingsResponse.json();
  assert.equal(settings.disable_signup, true, "disable_signup must remain true");
  assert.equal(settings.external?.google, true, "google provider did not enable");
  if (enableApple) {
    assert.equal(settings.external?.apple, true, "apple provider did not enable");
  }
  console.log(
    JSON.stringify(
      {
        verified: true,
        disable_signup: settings.disable_signup,
        google: settings.external?.google,
        apple: settings.external?.apple,
        email: settings.external?.email
      },
      null,
      2
    )
  );
}

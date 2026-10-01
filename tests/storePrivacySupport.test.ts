import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const privacy = readFileSync("docs/store/privacy-policy.md", "utf8");
const support = readFileSync("docs/store/support.md", "utf8");
const listing = readFileSync("docs/store/app-store-listing.md", "utf8");
const login = readFileSync("app/(auth)/login.tsx", "utf8");
const privacyRoute = readFileSync("app/settings/privacy.tsx", "utf8");
const supportRoute = readFileSync("app/settings/support.tsx", "utf8");
const appConfig = readFileSync("lib/appConfig.ts", "utf8");
const envExample = readFileSync(".env.example", "utf8");
const securityStatic = readFileSync("scripts/security-static.mjs", "utf8");
const routeSmoke = readFileSync("scripts/mobile-route-smoke.mjs", "utf8");
const layoutSmoke = readFileSync("scripts/mobile-layout-smoke.mjs", "utf8");

test("beta privacy policy names actual data flows and disabled providers", () => {
  assert.match(privacy, /Effective date: August 3, 2026/);
  assert.match(privacy, /Supabase/);
  assert.match(privacy, /Sentry/);
  assert.match(privacy, /PostHog/);
  assert.match(privacy, /supplier orders are drafts only/i);
  assert.match(privacy, /Square synchronization and webhooks are disabled/i);
  assert.match(privacy, /Gmail supplier delivery is disabled/i);
  assert.match(privacy, /live generative AI is disabled/i);
  assert.match(privacy, /billing and Stripe invoicing are disabled/i);
  assert.match(privacy, /autonomous supplier ordering is not available/i);
  assert.match(privacy, /privacy@getmise\.app/);
  assert.match(privacy, /support@getmise\.app/);
  assert.doesNotMatch(privacy, /placeholder|draft — requires legal review/i);
  assert.doesNotMatch(privacy, /send a purchase order to a supplier through Mise/i);
});

test("support guidance protects credentials and covers critical beta recovery", () => {
  for (const workflow of [
    "Access or role problem",
    "Sales CSV import",
    "Inventory is offline, pending, or conflicted",
    "Restaurant export or account deletion",
    "Suspected cross-restaurant access or security incident",
  ]) {
    assert.match(support, new RegExp(workflow, "i"));
  }
  assert.match(support, /Do not email passwords/i);
  assert.match(support, /safe reference ID/i);
  assert.match(support, /sent outside Mise/i);
});

test("store listing matches invite-only draft-only beta behavior", () => {
  assert.match(listing, /invite-only review account/i);
  assert.match(listing, /copy or export draft orders/i);
  assert.match(listing, /disabled in\s+production restaurant builds/i);
  assert.doesNotMatch(listing, /email supplier orders in two taps/i);
  assert.doesNotMatch(listing, /Approve and send orders in two taps/i);
  assert.doesNotMatch(listing, /create via in-app sign-up/i);
});

test("privacy and support remain discoverable before sign-in", () => {
  assert.match(login, /router\.push\("\/settings\/privacy"/);
  assert.match(login, /router\.push\("\/settings\/support"/);
  assert.match(login, /accessibilityRole="link"/);
  assert.doesNotMatch(
    login,
    /legalRow[^>]*accessibilityRole="text"/,
    "the legal-link container must not collapse its independently accessible links",
  );
  assert.doesNotMatch(privacyRoute, /if\s*\(\s*!user\s*\)/);
  assert.doesNotMatch(supportRoute, /if\s*\(\s*!user\s*\)/);
  assert.match(privacyRoute, /signedIn\s*\?\s*"\/settings"\s*:\s*"\/login"/);
  assert.match(supportRoute, /signedIn\s*\?\s*"\/settings"\s*:\s*"\/login"/);
});

test("contact and policy actions transmit only bounded public destinations", () => {
  assert.match(
    supportRoute,
    /const SUPPORT_MAILTO = "mailto:support@getmise\.app\?subject=Mise%20beta%20support"/,
  );
  assert.match(
    supportRoute,
    /const PRIVACY_MAILTO = "mailto:privacy@getmise\.app\?subject=Mise%20beta%20privacy"/,
  );
  assert.match(
    supportRoute,
    /Linking\.canOpenURL\(url\)[\s\S]*Linking\.openURL\(url\)/,
  );
  assert.doesNotMatch(supportRoute, /[?&](?:body|cc|bcc)=/i);
  assert.doesNotMatch(
    supportRoute,
    /const SUPPORT_PAGE_URL\s*=\s*"https:\/\/getmise\.app\/support"/,
  );
  assert.match(supportRoute, /readPublicAppConfig\(\)\.supportUrl/);
  assert.match(supportRoute, /disabled=\{opening \|\| !supportUrl\}/);
  assert.match(
    supportRoute,
    /Linking\.canOpenURL\(supportUrl\)[\s\S]*Linking\.openURL\(supportUrl\)/,
  );
  assert.match(supportRoute, /support\.missing\.title/);
  assert.match(supportRoute, /support\.hosting\.title/);
  assert.match(supportRoute, /support\.monitoring\.title/);
  assert.match(appConfig, /EXPO_PUBLIC_SUPPORT_URL/);
  assert.match(appConfig, /normalizeOptionalHttpsUrl/);
  assert.match(envExample, /EXPO_PUBLIC_SUPPORT_URL=/);
  assert.match(securityStatic, /EXPO_PUBLIC_SUPPORT_URL/);
  assert.match(
    privacyRoute,
    /const PRIVACY_POLICY_URL = "https:\/\/getmise\.app\/privacy"/,
  );
  assert.match(
    privacyRoute,
    /Linking\.canOpenURL\(PRIVACY_POLICY_URL\)[\s\S]*Linking\.openURL\(PRIVACY_POLICY_URL\)/,
  );
  assert.match(privacyRoute, /privacy\.hosting\.title/);
});

test("privacy and support routes are part of shell and localized mobile QA", () => {
  for (const route of ["/settings/privacy", "/settings/support"]) {
    assert.match(routeSmoke, new RegExp(`"${route}"`));
    assert.match(layoutSmoke, new RegExp(`"${route}"`));
  }
});

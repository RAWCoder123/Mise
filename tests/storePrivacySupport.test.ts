import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const privacy = readFileSync("docs/store/privacy-policy.md", "utf8");
const support = readFileSync("docs/store/support.md", "utf8");
const listing = readFileSync("docs/store/app-store-listing.md", "utf8");

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

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const eas = JSON.parse(readFileSync("eas.json", "utf8"));
const proof = readFileSync("scripts/verify-observability.mjs", "utf8");
const monitoring = readFileSync("docs/operations/MONITORING.md", "utf8");
const edge = readFileSync("supabase/functions/_shared/mise.ts", "utf8");

test("EAS profiles select isolated environments and explicit release identity", () => {
  for (const profile of ["development", "preview", "production"]) {
    assert.equal(eas.build[profile].environment, profile);
    assert.match(eas.build[profile].env.EXPO_PUBLIC_RELEASE, /^mise-mobile@/);
  }
  assert.equal(eas.build.preview.env.EXPO_PUBLIC_APP_ENV, "staging");
  assert.equal(eas.build.production.env.EXPO_PUBLIC_APP_ENV, "production");
  assert.equal(eas.build.production.env.EXPO_PUBLIC_ENABLE_DEMO_MODE, "false");
});

test("observability proof is credentialed, receipt-backed, and never prints provider keys", () => {
  assert.match(proof, /MISE_OBSERVABILITY_LIVE/);
  assert.match(proof, /waitForSentryReceipt/);
  assert.match(proof, /waitForPosthogReceipt/);
  assert.match(proof, /redaction_probe:\s*"\[redacted\]"/);
  assert.doesNotMatch(proof, /console\.log\s*\(\s*process\.env/);
});

test("monitoring defines correlation, alert ownership, and non-blocking behavior", () => {
  for (const field of [
    "request_id",
    "operation_id",
    "restaurant_id",
    "authoritative_event_id",
    "release"
  ]) {
    assert.match(monitoring, new RegExp(`\\b${field}\\b`));
  }
  assert.match(monitoring, /must never block/i);
  assert.match(monitoring, /tenant-boundary denial/i);
  assert.match(monitoring, /First owner/);
  assert.match(edge, /edge_authorization_denied/);
  assert.match(edge, /edge_firewall_blocked/);
});

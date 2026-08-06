import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const harness = readFileSync("scripts/staging-client-race.mjs", "utf8");

test("rendered race harness bounds every Chrome command and request hold", () => {
  assert.match(harness, /const cdpCommandTimeoutMs = 15000/);
  assert.match(harness, /Timed out waiting for Chrome command \$\{method\}/);
  assert.match(harness, /Timed out opening the Chrome debugging connection/);
  assert.match(harness, /Timed out waiting for \$\{holdLabel\}/);
  assert.match(harness, /timeout = 30000/);
});

test("rendered race harness clears pending commands and child processes", () => {
  assert.match(harness, /clearTimeout\(entry\.timeoutId\)/);
  assert.match(harness, /pending\.clear\(\)/);
  assert.match(harness, /rejectPending\(new Error\("Chrome debugging connection closed\."\)\)/);
  assert.match(harness, /await stopChild\(chromeProcess\)/);
  assert.match(harness, /await stopChild\(expoProcess\)/);
  assert.match(harness, /await rm\(chromeProfile, \{ recursive: true, force: true \}\)/);
});

test("rendered race harness still requires every route and mutation race", () => {
  for (const label of [
    "Today workspace switch",
    "inventory list workspace switch",
    "inventory detail workspace switch",
    "insights workspace switch",
    "settings workspace switch",
    "order detail workspace switch",
    "order mutation workspace switch"
  ]) {
    assert.match(harness, new RegExp(label));
  }
  assert.match(harness, /must pass the source-tenant role boundary|assertTenantBOnly/);
});

test("rendered race login readiness uses stable accessible controls instead of marketing copy", () => {
  assert.match(harness, /input\[aria-label="Email"\]/);
  assert.match(harness, /clickText\(cdp, "Continue"\)/);
  assert.match(harness, /input\[aria-label="Password"\]/);
  assert.match(harness, /clickText\(cdp, "Sign in"\)/);
  assert.doesNotMatch(harness, /innerText\.includes\('Open Mise'\)/);
  assert.match(
    harness,
    /innerText\.includes\('Luna Bistro'\)[\s\S]*Page\.navigate[\s\S]*innerText\.includes\('Luna chicken'\)/
  );
});

test("rendered race navigation prefers an actionable control when labels are duplicated", () => {
  assert.match(harness, /querySelectorAll\('\[aria-label=/);
  assert.match(harness, /\[role="tab"\]/);
  assert.match(harness, /candidate\.getAttribute\('aria-disabled'\) !== 'true'/);
  assert.doesNotMatch(
    harness,
    /const node = document\.querySelector\('\[aria-label=\$\{JSON\.stringify\(label\)\}\]'\)/
  );
});

test("rendered settings race uses a tenant-specific field that remains visible in the compact design", () => {
  assert.match(harness, /Service style\\\\nCafe/);
  assert.match(harness, /Service style\\s\+Fast casual Mediterranean/);
  assert.doesNotMatch(
    harness,
    /innerText\.includes\('Cafe Supply'\)[\s\S]{0,120}"Tenant B settings did not load/
  );
});

test("rendered order mutation race uses the compact review card accessibility contract", () => {
  assert.match(harness, /await clickAria\(cdp, "Open review"\)/);
  assert.doesNotMatch(harness, /await clickText\(cdp, "Open review"\)/);
});

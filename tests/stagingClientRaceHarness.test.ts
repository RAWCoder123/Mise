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
  assert.match(harness, /input\[aria-label="Password"\]/);
  assert.doesNotMatch(harness, /innerText\.includes\('Open Mise'\)/);
  assert.match(
    harness,
    /innerText\.includes\('Luna Bistro'\)[\s\S]*Page\.navigate[\s\S]*innerText\.includes\('Luna chicken'\)/
  );
});

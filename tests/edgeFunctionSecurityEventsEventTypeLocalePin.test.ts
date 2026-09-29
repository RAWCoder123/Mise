import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260929130000_mise_005ca_edge_function_security_events_event_type_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalBound = readFileSync(
  new URL(
    "../supabase/migrations/20260627053512_edge_function_firewall.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/edge_function_security_events_event_type_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";
const ALLOWLIST = [
  "allowed",
  "denied",
  "rate_limited",
  "blocked",
  "completed",
  "error"
] as const;

test("MISE-005CA pins edge_function_security_events event_type CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005CA"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint edge_function_security_events_event_type_check check \(\s*event_type in \(\s*'allowed', 'denied', 'rate_limited', 'blocked', 'completed', 'error'\s*\)\s*and event_type collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`event_type collate "C" ~ '${TOKEN_PATTERN}'`),
    "event_type CHECK must pin under COLLATE C"
  );
  for (const token of ALLOWLIST) {
    assert.ok(
      migration.includes(`'${token}'`),
      `exact event_type allowlist must preserve ${token}`
    );
  }

  // Compose: CHECK-only. Do not rewrite writers, policy, or sibling pins.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /edge_function_policy/i);
  assert.doesNotMatch(sqlBody, /function_name_check/i);
  assert.doesNotMatch(sqlBody, /alter table public\.insights/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /alter table public\.users/i);
});

test("original edge event_type used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /event_type text not null check \(\s*event_type in \(\s*'allowed',\s*'denied',\s*'rate_limited',\s*'blocked',\s*'completed',\s*'error'\s*\)\s*\)/
  );
  assert.doesNotMatch(
    originalBound,
    /event_type collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins edge event_type to COLLATE C", () => {
  assert.match(pgTap, /select plan\(13\)/);
  assert.match(pgTap, /edge_function_security_events_event_type_check exists/);
  assert.match(pgTap, /event_type CHECK keeps exact allowlist/);
  assert.match(pgTap, /event_type CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token allowed matches under COLLATE C/);
  assert.match(pgTap, /writer token rate_limited matches under COLLATE C/);
  assert.match(pgTap, /writer token completed matches under COLLATE C/);
  assert.match(pgTap, /spaced event_type token is rejected under COLLATE C/);
  assert.match(pgTap, /empty event_type token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated event_type token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII event_type token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted event_type tokens match under COLLATE C/);
  assert.match(pgTap, /the Edge event constraint still accepts rate_limited events/);
  assert.match(pgTap, /rate_limited-compatible event_type CHECK remains pinned under COLLATE C/);
});

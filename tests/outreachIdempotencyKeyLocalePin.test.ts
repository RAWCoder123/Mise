import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260928100000_mise_005bk_outreach_idempotency_key_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalFoundation = readFileSync(
  new URL(
    "../supabase/migrations/20260718010000_outreach_agent.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/outreach_idempotency_key_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const agentSource = readFileSync(
  new URL("../supabase/functions/outreach-agent/index.ts", import.meta.url),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const IDEMPOTENCY_PATTERN = "^[A-Za-z0-9_]{1,64}$";

const isAllowedIdempotencyKey = (value: string) =>
  new RegExp(IDEMPOTENCY_PATTERN).test(value);

test("MISE-005BK pins outreach_messages.idempotency_key CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005BK"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint outreach_messages_idempotency_key_check check \(\s*idempotency_key collate "C" ~ '\^\[A-Za-z0-9_\]\{1,64\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`idempotency_key collate "C" ~ '${IDEMPOTENCY_PATTERN}'`),
    "idempotency_key CHECK must pin under COLLATE C"
  );

  // Compose: CHECK-only. Do not rewrite agent writers or sibling pins.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /provider_message_id/);
  assert.doesNotMatch(sqlBody, /provider_event_id/);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.mise_actions/i);
  assert.doesNotMatch(sqlBody, /alter table public\.action_outcomes/i);
});

test("original outreach idempotency_key had no charset CHECK", () => {
  assert.match(
    originalFoundation,
    /idempotency_key text not null default \('outreach_' \|\| replace\(gen_random_uuid\(\)::text, '-', ''\)\) unique/
  );
  assert.doesNotMatch(
    originalFoundation,
    /idempotency_key collate "C" ~ '\^\[A-Za-z0-9_\]\{1,64\}\$'/
  );
  assert.doesNotMatch(
    originalFoundation,
    /outreach_messages_idempotency_key_check/
  );
});

test("outreach-agent still sends stored idempotency_key to Resend", () => {
  assert.match(
    agentSource,
    /"idempotency-key":\s*message\.idempotency_key/
  );
  assert.match(
    agentSource,
    /\.select\("id,sequence_number,subject,body_text,body_html,idempotency_key,attempt_count"\)/
  );
});

test("default outreach_ + hex mint matches the pinned CHECK contract", () => {
  const hex = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
  assert.equal(isAllowedIdempotencyKey(`outreach_${hex}`), true);
  assert.equal(isAllowedIdempotencyKey("outreach_ABCDEF0123456789abcdef0123456789"), true);
  assert.equal(isAllowedIdempotencyKey("outreach_short"), true);
  assert.equal(isAllowedIdempotencyKey("outreach key spaced"), false);
  assert.equal(isAllowedIdempotencyKey("outreach-with-hyphen"), false);
  assert.equal(isAllowedIdempotencyKey("outreach_\tctrl"), false);
  assert.equal(isAllowedIdempotencyKey(""), false);
  assert.equal(isAllowedIdempotencyKey("a".repeat(65)), false);
  assert.equal(isAllowedIdempotencyKey("a".repeat(64)), true);
});

test("pgTAP fixture pins outreach idempotency_key shape to COLLATE C", () => {
  assert.match(pgTap, /select plan\(12\)/);
  assert.match(pgTap, /outreach_messages_idempotency_key_check exists/);
  assert.match(pgTap, /outreach_messages idempotency_key CHECK uses COLLATE C/);
  assert.match(
    pgTap,
    /outreach_messages idempotency_key CHECK is not length-only/
  );
  assert.match(
    pgTap,
    /outreach_messages idempotency_key CHECK does not touch provider_message_id/
  );
  assert.match(
    pgTap,
    /default outreach_ \+ hex uuid mint matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /foundation default expression mint matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /uppercase hex outreach mint matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /short ASCII underscore mint matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /spaced outreach idempotency_key is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /hyphenated outreach idempotency_key is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /control-bearing outreach idempotency_key is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /empty outreach idempotency_key is rejected under COLLATE C/
  );
});

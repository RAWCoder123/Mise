import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260928090000_mise_005bj_outreach_provider_message_id_locale_pin.sql",
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
    "../supabase/tests/database/outreach_provider_message_id_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const agentSource = readFileSync(
  new URL("../supabase/functions/outreach-agent/index.ts", import.meta.url),
  "utf8"
);
const webhookSource = readFileSync(
  new URL("../supabase/functions/outreach-webhook/index.ts", import.meta.url),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;

const isAllowedProviderMessageId = (value: string | null) =>
  value === null ||
  (value.length >= 1 &&
    value.length <= 512 &&
    !CONTROL_CHARACTERS.test(value));

test("MISE-005BJ pins outreach provider_message_id CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005BJ"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint outreach_messages_provider_message_id_check\s+check \(\s*provider_message_id is null\s+or \(\s*length\(provider_message_id\) between 1 and 512\s+and provider_message_id collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );
  assert.match(
    migration,
    /add constraint outreach_events_provider_message_id_check\s+check \(\s*provider_message_id is null\s+or \(\s*length\(provider_message_id\) between 1 and 512\s+and provider_message_id collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );

  assert.ok(
    migration.includes(`provider_message_id collate "C" !~ '[[:cntrl:]]'`),
    "provider_message_id CHECK must pin cntrl under COLLATE C"
  );
  assert.ok(
    migration.includes("length(provider_message_id) between 1 and 512"),
    "provider_message_id CHECK must bound length 1–512"
  );

  // Compose: do not rewrite contested webhook / agent writers, sibling
  // provider_event_id CHECK (#469), free-form event_type, or supplier message ids.
  // The DO loop may mention provider_event_id only as an exclusion filter so it
  // never drops outreach_events_provider_event_id_check.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /idempotency_key/);
  assert.doesNotMatch(sqlBody, /outreach_events_provider_event_id_check/);
  assert.doesNotMatch(sqlBody, /add constraint \w*provider_event_id/i);
  assert.doesNotMatch(sqlBody, /event_type/);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /alter table private\.supplier_email_deliveries/i);
  assert.doesNotMatch(sqlBody, /alter table public\.supplier_orders/i);
});

test("original outreach provider_message_id columns had no cntrl CHECK", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.outreach_messages \([\s\S]*?provider_message_id text unique,/
  );
  assert.match(
    originalFoundation,
    /create table if not exists public\.outreach_events \([\s\S]*?provider_message_id text,/
  );
  assert.doesNotMatch(
    originalFoundation,
    /provider_message_id collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.doesNotMatch(
    originalFoundation,
    /outreach_messages_provider_message_id_check/
  );
  assert.doesNotMatch(
    originalFoundation,
    /outreach_events_provider_message_id_check/
  );
});

test("agent and webhook still persist Resend provider_message_id for join", () => {
  assert.match(
    agentSource,
    /provider_message_id:\s*providerPayload\.id/
  );
  assert.match(
    webhookSource,
    /provider_message_id:\s*providerMessageId/
  );
  assert.match(
    webhookSource,
    /\.eq\("provider_message_id",\s*providerMessageId\)/
  );
});

test("length + cntrl class matches the pinned CHECK contract", () => {
  assert.equal(isAllowedProviderMessageId(null), true);
  assert.equal(isAllowedProviderMessageId("re_2KhT9abc"), true);
  assert.equal(isAllowedProviderMessageId("re_lower_1"), true);
  assert.equal(isAllowedProviderMessageId("uuid-like-id"), true);
  assert.equal(isAllowedProviderMessageId(""), false);
  assert.equal(isAllowedProviderMessageId("re_\tA"), false);
  assert.equal(isAllowedProviderMessageId("re_\u0001A"), false);
  assert.equal(isAllowedProviderMessageId("re_\u007f"), false);
  assert.equal(isAllowedProviderMessageId("a".repeat(513)), false);
  assert.equal(isAllowedProviderMessageId("a".repeat(512)), true);
});

test("pgTAP fixture pins outreach provider_message_id CHECKs to COLLATE C", () => {
  assert.match(pgTap, /select plan\(12\)/);
  assert.match(pgTap, /outreach_messages_provider_message_id_check exists/);
  assert.match(pgTap, /outreach_events_provider_message_id_check exists/);
  assert.match(
    pgTap,
    /outreach_messages\.provider_message_id CHECK uses COLLATE C cntrl rejection/
  );
  assert.match(
    pgTap,
    /outreach_events\.provider_message_id CHECK uses COLLATE C cntrl rejection/
  );
  assert.match(
    pgTap,
    /outreach_messages\.provider_message_id CHECK bounds length 1–512/
  );
  assert.match(
    pgTap,
    /outreach_events\.provider_message_id CHECK bounds length 1–512/
  );
  assert.match(pgTap, /ASCII tab is a control under COLLATE C/);
  assert.match(
    pgTap,
    /printable ASCII Resend id is not a control under COLLATE C/
  );
  assert.match(
    pgTap,
    /printable ASCII lowercase Resend id is not a control under COLLATE C/
  );
  assert.match(pgTap, /ASCII DEL is a control under COLLATE C/);
  assert.match(pgTap, /outreach_messages\.provider_message_id CHECK allows null/);
  assert.match(pgTap, /outreach_events\.provider_message_id CHECK allows null/);
});

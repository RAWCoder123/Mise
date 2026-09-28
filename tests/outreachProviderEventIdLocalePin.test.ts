import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260928080000_mise_005bi_outreach_provider_event_id_locale_pin.sql",
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
    "../supabase/tests/database/outreach_provider_event_id_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const webhookSource = readFileSync(
  new URL("../supabase/functions/outreach-webhook/index.ts", import.meta.url),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;

const isAllowedProviderEventId = (value: string) =>
  value.length >= 1 &&
  value.length <= 255 &&
  !CONTROL_CHARACTERS.test(value);

test("MISE-005BI pins outreach_events.provider_event_id CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005BI"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint outreach_events_provider_event_id_check\s+check \(\s*length\(provider_event_id\) between 1 and 255\s+and provider_event_id collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );

  assert.ok(
    migration.includes(`provider_event_id collate "C" !~ '[[:cntrl:]]'`),
    "provider_event_id CHECK must pin cntrl under COLLATE C"
  );
  assert.ok(
    migration.includes("length(provider_event_id) between 1 and 255"),
    "provider_event_id CHECK must bound length 1–255"
  );

  // Compose: do not rewrite contested webhook / message writers or free-form
  // ledgers.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_messages/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /alter table private\.supplier_email_deliveries/i);
  assert.doesNotMatch(sqlBody, /event_type/);
});

test("original outreach_events.provider_event_id had no cntrl CHECK", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.outreach_events \([\s\S]*?provider_event_id text not null unique,/
  );
  assert.doesNotMatch(
    originalFoundation,
    /provider_event_id collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.doesNotMatch(
    originalFoundation,
    /outreach_events_provider_event_id_check/
  );
});

test("webhook still persists verified svix-id as provider_event_id", () => {
  assert.match(
    webhookSource,
    /provider_event_id:\s*svixId/
  );
  assert.match(
    webhookSource,
    /new\s+Webhook\(webhookSecret\)\.verify\(/
  );
});

test("length + cntrl class matches the pinned CHECK contract", () => {
  assert.equal(isAllowedProviderEventId("msg_2KhT9abc"), true);
  assert.equal(isAllowedProviderEventId("msg_lower_1"), true);
  assert.equal(isAllowedProviderEventId("uuid-like-id"), true);
  assert.equal(isAllowedProviderEventId(""), false);
  assert.equal(isAllowedProviderEventId("msg_\tA"), false);
  assert.equal(isAllowedProviderEventId("msg_\u0001A"), false);
  assert.equal(isAllowedProviderEventId("msg_\u007f"), false);
  assert.equal(isAllowedProviderEventId("a".repeat(256)), false);
  assert.equal(isAllowedProviderEventId("a".repeat(255)), true);
});

test("pgTAP fixture pins outreach_events.provider_event_id CHECK to COLLATE C", () => {
  assert.match(pgTap, /select plan\(7\)/);
  assert.match(pgTap, /outreach_events_provider_event_id_check exists/);
  assert.match(
    pgTap,
    /provider_event_id CHECK uses COLLATE C cntrl rejection/
  );
  assert.match(pgTap, /provider_event_id CHECK bounds length 1–255/);
  assert.match(pgTap, /ASCII tab is a control under COLLATE C/);
  assert.match(
    pgTap,
    /printable ASCII Svix id is not a control under COLLATE C/
  );
  assert.match(
    pgTap,
    /printable ASCII lowercase Svix id is not a control under COLLATE C/
  );
  assert.match(pgTap, /ASCII DEL is a control under COLLATE C/);
});

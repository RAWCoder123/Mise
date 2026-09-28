import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260928020000_mise_005bc_outreach_campaign_timezone_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalOutreach = readFileSync(
  new URL("../supabase/migrations/20260718010000_outreach_agent.sql", import.meta.url),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/outreach_campaign_timezone_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const edgeSource = readFileSync(
  new URL("../supabase/functions/outreach-agent/index.ts", import.meta.url),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TIMEZONE_PATTERN = "^[A-Za-z0-9/_+-]{1,64}$";

test("MISE-005BC pins outreach_campaigns.timezone CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005BC"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint outreach_campaigns_timezone_check check \(\s*timezone collate "C" ~ '\^\[A-Za-z0-9\/_\+-\]\{1,64\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`timezone collate "C" ~ '${TIMEZONE_PATTERN}'`),
    "timezone CHECK must pin under COLLATE C"
  );

  // Compose: do not rewrite restaurants.timezone (#462), outreach email/URL
  // CHECKs (#420/#421/#443), or campaign writers beyond the Edge shape gate.
  // Exclusion-filter mentions of sender_email / reply_to / cta_url in the drop
  // loop are intentional and must not become rewrite targets.
  assert.doesNotMatch(sqlBody, /alter table public\.restaurants/i);
  assert.doesNotMatch(sqlBody, /restaurants_timezone/i);
  assert.doesNotMatch(sqlBody, /add constraint[^;]*sender_email/i);
  assert.doesNotMatch(sqlBody, /add constraint[^;]*reply_to/i);
  assert.doesNotMatch(sqlBody, /add constraint[^;]*cta_url/i);
  assert.doesNotMatch(sqlBody, /email_normalized/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
  assert.doesNotMatch(sqlBody, /create or replace function/i);
});

test("original outreach_campaigns.timezone CHECK was length-only", () => {
  assert.match(
    originalOutreach,
    /timezone text not null default 'America\/New_York' check \(char_length\(timezone\) between 1 and 100\)/
  );
  assert.doesNotMatch(
    originalOutreach,
    /timezone collate "C" ~ '\^\[A-Za-z0-9\/_\+-\]\{1,64\}\$'/
  );
});

test("Edge create_campaign IANA timezone shape matches the pinned ASCII class", () => {
  assert.match(edgeSource, /const IANA_TIMEZONE_SHAPE_PATTERN = \/\^\[A-Za-z0-9\/_\+-\]\{1,64\}\$\//);
  assert.match(edgeSource, /function isIanaTimezoneShape\(value: string\)/);
  assert.match(edgeSource, /if \(!isIanaTimezoneShape\(value\)\) return false;/);
  assert.match(
    edgeSource,
    /optionalString\(input\.timezone, "timezone", 64\)/
  );
  assert.doesNotMatch(
    edgeSource,
    /optionalString\(input\.timezone, "timezone", 100\)/
  );

  // Mirror the Edge allowlist locally so the static contract stays executable.
  const IANA_TIMEZONE_SHAPE_PATTERN = /^[A-Za-z0-9/_+-]{1,64}$/;
  const isIanaTimezoneShape = (value: string) => IANA_TIMEZONE_SHAPE_PATTERN.test(value);

  assert.equal(isIanaTimezoneShape("America/New_York"), true);
  assert.equal(isIanaTimezoneShape("Etc/GMT+5"), true);
  assert.equal(isIanaTimezoneShape("UTC"), true);
  assert.equal(isIanaTimezoneShape("America/New York"), false);
  assert.equal(isIanaTimezoneShape("America/São_Paulo"), false);
  assert.equal(isIanaTimezoneShape("America/New_York\t"), false);
  assert.equal(isIanaTimezoneShape(""), false);
  assert.equal(isIanaTimezoneShape("a".repeat(65)), false);
  assert.equal(isIanaTimezoneShape("a".repeat(100)), false);
});

test("pgTAP fixture pins outreach_campaigns.timezone shape to COLLATE C", () => {
  assert.match(pgTap, /select plan\(8\)/);
  assert.match(pgTap, /outreach_campaigns_timezone_check exists/);
  assert.match(pgTap, /outreach_campaigns\.timezone CHECK uses COLLATE C IANA ASCII shape/);
  assert.match(pgTap, /outreach_campaigns\.timezone CHECK is not length-only/);
  assert.match(pgTap, /America\/New_York matches under COLLATE C/);
  assert.match(pgTap, /Etc\/GMT\+5 matches under COLLATE C/);
  assert.match(pgTap, /spaced timezone label is rejected under COLLATE C/);
  assert.match(pgTap, /ASCII tab timezone is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII timezone label is rejected under COLLATE C/);
});

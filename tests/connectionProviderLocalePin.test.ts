import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930250000_mise_005dk_connection_provider_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalPos = readFileSync(
  new URL(
    "../supabase/migrations/202606210002_restaurant_ops_backbone.sql",
    import.meta.url
  ),
  "utf8"
);
const originalEmail = readFileSync(
  new URL(
    "../supabase/migrations/20260622053735_email_scaffolding.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/connection_provider_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005DK pins POS and email connection provider CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005DK"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint pos_integrations_provider_check\s+check \(\s*provider in \('square', 'toast', 'clover', 'lightspeed', 'manual_csv', 'demo'\)\s*and provider collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint restaurant_email_connections_provider_check\s+check \(\s*provider in \('gmail'\)\s*and provider collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`provider collate "C" ~ '${TOKEN_PATTERN}'`),
    "provider CHECKs must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'square'") &&
      migration.includes("'toast'") &&
      migration.includes("'clover'") &&
      migration.includes("'lightspeed'") &&
      migration.includes("'manual_csv'") &&
      migration.includes("'demo'"),
    "exact POS provider allowlist must be preserved"
  );
  assert.ok(migration.includes("'gmail'"), "exact email provider allowlist must be preserved");

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /service_fail_square_oauth/i);
  assert.doesNotMatch(sqlBody, /service_fail_gmail_oauth/i);
  assert.doesNotMatch(sqlBody, /service_complete_square_oauth/i);
  assert.doesNotMatch(sqlBody, /service_complete_gmail_oauth/i);
  assert.doesNotMatch(sqlBody, /sync_cursor/i);
  assert.doesNotMatch(sqlBody, /external_location_id/i);
  assert.doesNotMatch(sqlBody, /provider_subject/i);
  assert.doesNotMatch(sqlBody, /sender_email/i);
  assert.doesNotMatch(sqlBody, /pos_integrations_status_check/i);
  assert.doesNotMatch(sqlBody, /restaurant_email_connections_status_check/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_lines/i);
  assert.doesNotMatch(sqlBody, /alter table public\.ai_insights/i);
  assert.doesNotMatch(sqlBody, /generation_provider/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
});

test("original connection provider columns used bare IN without COLLATE C shape", () => {
  assert.match(
    originalPos,
    /provider text not null check \(provider in \('square', 'toast', 'clover', 'lightspeed', 'manual_csv', 'demo'\)\)/
  );
  assert.match(
    originalEmail,
    /provider text not null default 'gmail' check \(provider in \('gmail'\)\)/
  );
  assert.doesNotMatch(
    originalPos,
    /provider collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    originalEmail,
    /provider collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins connection provider to COLLATE C", () => {
  assert.match(pgTap, /select plan\(23\)/);
  assert.match(pgTap, /pos_integrations_provider_check exists/);
  assert.match(pgTap, /pos_integrations provider CHECK keeps exact allowlist/);
  assert.match(pgTap, /pos_integrations provider CHECK uses COLLATE C/);
  assert.match(pgTap, /restaurant_email_connections_provider_check exists/);
  assert.match(
    pgTap,
    /restaurant_email_connections provider CHECK keeps exact allowlist/
  );
  assert.match(
    pgTap,
    /restaurant_email_connections provider CHECK uses COLLATE C/
  );
  assert.match(pgTap, /writer token square matches under COLLATE C/);
  assert.match(pgTap, /writer token toast matches under COLLATE C/);
  assert.match(pgTap, /writer token clover matches under COLLATE C/);
  assert.match(pgTap, /writer token lightspeed matches under COLLATE C/);
  assert.match(pgTap, /writer token manual_csv matches under COLLATE C/);
  assert.match(pgTap, /writer token demo matches under COLLATE C/);
  assert.match(pgTap, /writer token gmail matches under COLLATE C/);
  assert.match(pgTap, /spaced POS provider token is rejected under COLLATE C/);
  assert.match(pgTap, /spaced email provider token is rejected under COLLATE C/);
  assert.match(pgTap, /empty POS provider token is rejected under COLLATE C/);
  assert.match(pgTap, /empty email provider token is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /punctuated POS provider token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /punctuated email provider token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /non-ASCII POS provider token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /non-ASCII email provider token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /all allowlisted POS provider tokens match under COLLATE C/
  );
  assert.match(
    pgTap,
    /all allowlisted email provider tokens match under COLLATE C/
  );
});

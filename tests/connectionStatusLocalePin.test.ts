import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930020000_mise_005cn_connection_status_locale_pin.sql",
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
    "../supabase/tests/database/connection_status_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005CN pins POS and email connection status CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005CN"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint pos_integrations_status_check\s+check \(\s*status in \('not_connected', 'connected', 'paused', 'error'\)\s*and status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint restaurant_email_connections_status_check\s+check \(\s*status in \('not_connected', 'connected', 'needs_reauth', 'restricted'\)\s*and status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`status collate "C" ~ '${TOKEN_PATTERN}'`),
    "status CHECKs must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'not_connected'") &&
      migration.includes("'connected'") &&
      migration.includes("'paused'") &&
      migration.includes("'error'"),
    "exact POS status allowlist must be preserved"
  );
  assert.ok(
    migration.includes("'needs_reauth'") && migration.includes("'restricted'"),
    "exact email status allowlist must be preserved"
  );

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
  assert.doesNotMatch(sqlBody, /restaurant_tasks/i);
  assert.doesNotMatch(sqlBody, /supplier_orders/i);
  assert.doesNotMatch(sqlBody, /recalculation_runs/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /pos_integrations_provider/i);
  assert.doesNotMatch(sqlBody, /restaurant_email_connections_provider/i);
});

test("original connection status columns used bare IN without COLLATE C shape", () => {
  assert.match(
    originalPos,
    /status text not null default 'not_connected' check \(status in \('not_connected', 'connected', 'paused', 'error'\)\)/
  );
  assert.match(
    originalEmail,
    /status text not null default 'not_connected' check \(status in \('not_connected', 'connected', 'needs_reauth', 'restricted'\)\)/
  );
  assert.doesNotMatch(
    originalPos,
    /status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    originalEmail,
    /status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins connection status to COLLATE C", () => {
  assert.match(pgTap, /select plan\(22\)/);
  assert.match(pgTap, /pos_integrations_status_check exists/);
  assert.match(pgTap, /pos_integrations status CHECK keeps exact allowlist/);
  assert.match(pgTap, /pos_integrations status CHECK uses COLLATE C/);
  assert.match(pgTap, /restaurant_email_connections_status_check exists/);
  assert.match(
    pgTap,
    /restaurant_email_connections status CHECK keeps exact allowlist/
  );
  assert.match(
    pgTap,
    /restaurant_email_connections status CHECK uses COLLATE C/
  );
  assert.match(pgTap, /writer token not_connected matches under COLLATE C/);
  assert.match(pgTap, /writer token connected matches under COLLATE C/);
  assert.match(pgTap, /writer token paused matches under COLLATE C/);
  assert.match(pgTap, /writer token error matches under COLLATE C/);
  assert.match(pgTap, /writer token needs_reauth matches under COLLATE C/);
  assert.match(pgTap, /writer token restricted matches under COLLATE C/);
  assert.match(pgTap, /spaced POS status token is rejected under COLLATE C/);
  assert.match(pgTap, /spaced email status token is rejected under COLLATE C/);
  assert.match(pgTap, /empty POS status token is rejected under COLLATE C/);
  assert.match(pgTap, /empty email status token is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /punctuated POS status token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /punctuated email status token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /non-ASCII POS status token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /non-ASCII email status token is rejected under COLLATE C/
  );
  assert.match(pgTap, /all allowlisted POS status tokens match under COLLATE C/);
  assert.match(
    pgTap,
    /all allowlisted email status tokens match under COLLATE C/
  );
});

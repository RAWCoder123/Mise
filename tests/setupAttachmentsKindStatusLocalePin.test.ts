import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001090000_mise_005ee_setup_attachments_kind_status_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/20260623001301_setup_persistence_observability.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/setup_attachments_kind_status_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005EE pins setup_attachments kind and status CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005EE"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint setup_attachments_kind_check\s+check \(\s*kind in \('csv', 'screenshot'\)\s*and kind collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint setup_attachments_status_check\s+check \(\s*status in \('queued', 'review_needed', 'processed', 'dismissed'\)\s*and status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`kind collate "C" ~ '${TOKEN_PATTERN}'`),
    "kind CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes(`status collate "C" ~ '${TOKEN_PATTERN}'`),
    "status CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'csv'") &&
      migration.includes("'screenshot'") &&
      migration.includes("'queued'") &&
      migration.includes("'review_needed'") &&
      migration.includes("'processed'") &&
      migration.includes("'dismissed'"),
    "exact kind and status allowlists must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /save_restaurant_setup/i);
  assert.doesNotMatch(sqlBody, /setup_attachments_metadata_only_check/i);
  assert.doesNotMatch(sqlBody, /backend_identity/i);
  assert.doesNotMatch(sqlBody, /requested_action/i);
  assert.doesNotMatch(sqlBody, /control_domain/i);
  assert.doesNotMatch(sqlBody, /alter table private\.pilot_operational_control_changes/i);
  assert.doesNotMatch(sqlBody, /alter table public\.sales_imports/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
});

test("original setup_attachments kind and status used bare IN without COLLATE C shape", () => {
  assert.match(
    original,
    /create table if not exists public\.setup_attachments[\s\S]*?kind text not null check \(kind in \('csv', 'screenshot'\)\)[\s\S]*?status text not null default 'queued' check \(status in \('queued', 'review_needed', 'processed', 'dismissed'\)\)/
  );
  assert.doesNotMatch(
    original,
    /kind collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    original,
    /status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins setup_attachments kind and status to COLLATE C", () => {
  assert.match(pgTap, /select plan\(17\)/);
  assert.match(pgTap, /setup_attachments_kind_check exists/);
  assert.match(pgTap, /setup_attachments_status_check exists/);
  assert.match(pgTap, /setup_attachments kind CHECK keeps exact allowlist/);
  assert.match(pgTap, /setup_attachments kind CHECK uses COLLATE C/);
  assert.match(pgTap, /setup_attachments status CHECK keeps exact allowlist/);
  assert.match(pgTap, /setup_attachments status CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token csv matches under COLLATE C/);
  assert.match(pgTap, /writer token screenshot matches under COLLATE C/);
  assert.match(pgTap, /writer token queued matches under COLLATE C/);
  assert.match(pgTap, /writer token review_needed matches under COLLATE C/);
  assert.match(pgTap, /writer token processed matches under COLLATE C/);
  assert.match(pgTap, /writer token dismissed matches under COLLATE C/);
  assert.match(pgTap, /spaced status token is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /empty setup attachment vocabulary token is rejected under COLLATE C/
  );
  assert.match(pgTap, /punctuated status token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII status token is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /all allowlisted kind and status tokens match under COLLATE C/
  );
});

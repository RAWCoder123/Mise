import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261006150000_mise_005in_beta_provisioning_name_cuisine_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/20260728210609_enforce_invite_only_beta_admission.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/beta_provisioning_name_cuisine_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005IN pins beta provisioning name/cuisine CHECKs to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005IN"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint beta_restaurant_provisioning_requests_name_check check \(\s*pg_catalog\.length\(normalized_restaurant_name\) between 1 and 120\s*and normalized_restaurant_name collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );
  assert.match(
    migration,
    /add constraint beta_restaurant_provisioning_requests_cuisine_check check \(\s*normalized_cuisine_type is null\s*or \(\s*pg_catalog\.length\(normalized_cuisine_type\) <= 120\s*and normalized_cuisine_type collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );

  assert.ok(
    migration.includes(
      `normalized_restaurant_name collate "C" !~ '[[:cntrl:]]'`
    ),
    "provisioning name CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes(
      `normalized_cuisine_type collate "C" !~ '[[:cntrl:]]'`
    ),
    "provisioning cuisine CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("between 1 and 120"),
    "exact name length bound must be preserved"
  );
  assert.ok(migration.includes("<= 120"), "exact cuisine length bound must be preserved");

  // Compose: CHECK-only. Do not rewrite the service provisioner or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /service_provision_beta_restaurant/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurants/i);
  assert.doesNotMatch(sqlBody, /restaurants_name_length_check/i);
  assert.doesNotMatch(sqlBody, /restaurants_cuisine_type_length_check/i);
  assert.doesNotMatch(sqlBody, /alter table public\.users/i);
  assert.doesNotMatch(sqlBody, /restaurant_workspace_allocations/i);
});

test("original beta provisioning name/cuisine columns had no table CHECK", () => {
  assert.match(
    original,
    /create table private\.beta_restaurant_provisioning_requests \(\s*idempotency_key uuid primary key,\s*owner_user_id uuid not null references auth\.users\(id\) on delete cascade,\s*normalized_restaurant_name text not null,\s*normalized_cuisine_type text,/
  );
  assert.doesNotMatch(
    original,
    /beta_restaurant_provisioning_requests_name_check/
  );
  assert.doesNotMatch(
    original,
    /beta_restaurant_provisioning_requests_cuisine_check/
  );
  assert.doesNotMatch(
    original,
    /normalized_restaurant_name[\s\S]{0,200}\[\[:cntrl:\]\]/
  );
  assert.doesNotMatch(
    original,
    /normalized_cuisine_type[\s\S]{0,200}\[\[:cntrl:\]\]/
  );

  assert.match(
    original,
    /if pg_catalog\.length\(normalized_name\) not between 1 and 120/
  );
  assert.match(
    original,
    /if normalized_cuisine is not null and pg_catalog\.length\(normalized_cuisine\) > 120/
  );
});

test("pgTAP fixture pins beta provisioning name/cuisine shape to COLLATE C", () => {
  assert.match(pgTap, /select plan\(14\)/);
  assert.match(pgTap, /beta_restaurant_provisioning_requests_name_check exists/);
  assert.match(
    pgTap,
    /beta provisioning name CHECK uses COLLATE C cntrl rejection/
  );
  assert.match(
    pgTap,
    /beta_restaurant_provisioning_requests_cuisine_check exists/
  );
  assert.match(
    pgTap,
    /beta provisioning cuisine CHECK uses COLLATE C cntrl rejection/
  );
  assert.match(
    pgTap,
    /printable provisioning name text is accepted under COLLATE C/
  );
  assert.match(
    pgTap,
    /tab in provisioning name text is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /newline in provisioning name text is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /DEL in provisioning name text is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /printable provisioning cuisine text is accepted under COLLATE C/
  );
  assert.match(
    pgTap,
    /tab in provisioning cuisine text is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /provisioning control detector matches ASCII C \[\[:cntrl:\]\]/
  );
  assert.match(
    pgTap,
    /ASCII control detector is identical under C and under the database ctype/
  );
});

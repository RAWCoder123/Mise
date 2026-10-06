import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261007050000_mise_005is_supplier_delivery_discrepancy_reason_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const foundation = readFileSync(
  new URL(
    "../supabase/migrations/20260802204120_operational_backend_foundation.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/supplier_delivery_discrepancy_reason_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005IS pins supplier_delivery_items.discrepancy_reason CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005IS"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint supplier_delivery_items_reason_bound_check check \(\s*discrepancy_reason is null\s*or \(\s*length\(discrepancy_reason\) <= 500\s*and discrepancy_reason collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );

  assert.ok(
    migration.includes(`discrepancy_reason collate "C" !~ '[[:cntrl:]]'`),
    "discrepancy_reason CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(discrepancy_reason) <= 500"),
    "exact discrepancy_reason length bound must be preserved"
  );
  assert.ok(
    migration.includes("discrepancy_reason is null"),
    "nullability must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite receive writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /record_supplier_delivery/i);
  assert.doesNotMatch(sqlBody, /supplier_deliveries\.notes/i);
  assert.doesNotMatch(sqlBody, /client_delivery_id/i);
  assert.doesNotMatch(sqlBody, /inventory_events/i);
  assert.doesNotMatch(sqlBody, /mise_actions/i);
  assert.doesNotMatch(sqlBody, /canonical_unit/i);
  assert.doesNotMatch(sqlBody, /alter table public\.supplier_deliveries/i);
});

test("foundation originally bounded discrepancy_reason by length only without cntrl gate", () => {
  assert.match(
    foundation,
    /constraint supplier_delivery_items_reason_bound_check\s+check \(discrepancy_reason is null or length\(discrepancy_reason\) <= 500\)/
  );
  assert.doesNotMatch(
    foundation,
    /supplier_delivery_items_reason_bound_check[\s\S]{0,120}\[\[:cntrl:\]\]/
  );
});

test("pgTAP fixture pins discrepancy_reason CHECK site with plan derived from call sites", () => {
  const assertionSites = [
    ...pgTap.matchAll(/^\s*select\s+(ok|is|matches|throws_ok|lives_ok)\s*\(/gim)
  ];
  assert.equal(
    assertionSites.length,
    10,
    "pgTAP assertion call-site count must stay independently counted"
  );
  assert.match(pgTap, /select plan\(10\)/);
  assert.match(pgTap, /supplier_delivery_items_reason_bound_check exists/);
  assert.match(pgTap, /discrepancy_reason CHECK keeps exact length bound/);
  assert.match(
    pgTap,
    /discrepancy_reason CHECK uses COLLATE C cntrl rejection/
  );
  assert.match(pgTap, /discrepancy_reason CHECK keeps nullability/);
  assert.match(
    pgTap,
    /printable discrepancy reason is accepted under COLLATE C/
  );
  assert.match(pgTap, /tab in discrepancy reason is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /newline in discrepancy reason is rejected under COLLATE C/
  );
  assert.match(pgTap, /DEL in discrepancy reason is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /discrepancy reason control detector matches ASCII C \[\[:cntrl:\]\]/
  );
  assert.match(
    pgTap,
    /ASCII control detector is identical under C and under the database ctype/
  );
});

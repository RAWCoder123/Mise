import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001500000_mise_005ft_audit_logs_entity_table_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/202606210002_restaurant_ops_backbone.sql",
    import.meta.url
  ),
  "utf8"
);
const edgeWriter = readFileSync(
  new URL(
    "../supabase/migrations/20260716204112_reinforce_tenant_isolation.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/audit_logs_entity_table_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005FT pins audit_logs.entity_table CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005FT"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint audit_logs_entity_table_check check \(\s*length\(trim\(entity_table\)\) between 1 and 120\s*and entity_table collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );
  assert.ok(
    migration.includes(`entity_table collate "C" !~ '[[:cntrl:]]'`),
    "audit_logs entity_table CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(entity_table)) between 1 and 120"),
    "exact length(trim) bound must match service_record_edge_audit_log 120 writer"
  );
  assert.doesNotMatch(
    migration,
    /entity_table is null/,
    "entity_table is NOT NULL; CHECK must not preserve a null branch"
  );

  // Compose: CHECK-only. Do not rewrite edge audit writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /service_record_edge_audit_log/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.mise_actions/i);
  assert.doesNotMatch(sqlBody, /alter table public\.sales_imports/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_integrations/i);
  assert.doesNotMatch(
    sqlBody,
    /audit_logs_action_check/,
    "must not attach or rewrite the action sibling CHECK"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint[^;]*\baction\b/i,
    "must not add an action constraint"
  );
  assert.doesNotMatch(
    sqlBody,
    /\^[a-z0-9_]+/,
    "must not expand to charset allowlist; cntrl-only tip"
  );
  assert.match(
    migration,
    /not ilike '%action%'/,
    "must leave action bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%entity_id%'/,
    "must leave entity_id (uuid) untouched"
  );
  assert.match(
    migration,
    /not ilike '%metadata%'/,
    "must leave metadata bounds untouched"
  );
  assert.match(
    migration,
    /service_record_edge_audit_log/,
    "migration rationale must document the edge writer 120 bound"
  );
});

test("original audit_logs.entity_table had no CHECK; edge writer bounds length to 120", () => {
  assert.match(
    original,
    /create table if not exists public\.audit_logs \([\s\S]*?entity_table text not null,/
  );
  assert.doesNotMatch(
    original,
    /create table if not exists public\.audit_logs \([\s\S]*?entity_table text not null[^\n]*check/
  );
  assert.doesNotMatch(original, /audit_logs_entity_table_check/);

  assert.match(
    edgeWriter,
    /pg_catalog\.length\(p_entity_table\) not between 1 and 120/
  );
  assert.match(
    edgeWriter,
    /insert into public\.audit_logs \(\s*restaurant_id, actor_user_id, action, entity_table, entity_id, metadata/
  );
});

test("NOT NULL length(trim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedEntityTable = (value: string) =>
    value.trim().length >= 1 &&
    value.trim().length <= 120 &&
    !/[\u0000-\u001f\u007f]/.test(value);

  assert.equal(isAllowedEntityTable("purchase_recommendations"), true);
  assert.equal(isAllowedEntityTable("supplier_orders"), true);
  assert.equal(isAllowedEntityTable("mise_actions"), true);
  assert.equal(isAllowedEntityTable("a".repeat(120)), true);
  assert.equal(isAllowedEntityTable("a".repeat(121)), false);
  assert.equal(isAllowedEntityTable(""), false);
  assert.equal(isAllowedEntityTable("   "), false);
  assert.equal(isAllowedEntityTable("purchase\trecommendations"), false);
  assert.equal(isAllowedEntityTable("purchase\nrecommendations"), false);
  assert.equal(isAllowedEntityTable("purchase\u0000recommendations"), false);
  assert.equal(isAllowedEntityTable("purchase\u007frecommendations"), false);
});

test("pgTAP plan is derived from assertion call sites, not from a passing run", () => {
  const planMatch = pgTap.match(/select plan\((\d+)\);/);
  assert.ok(planMatch, "pgTAP file must declare an explicit plan");
  const planned = Number(planMatch[1]);

  const assertionCalls = [
    ...pgTap.matchAll(
      /^\s*select\s+(ok|is|matches|throws_ok|lives_ok|isnt|alike|throws_like)\s*\(/gim
    )
  ];
  assert.equal(
    planned,
    assertionCalls.length,
    `plan(${planned}) must equal ${assertionCalls.length} assertion call sites counted from source`
  );

  assert.match(pgTap, /entity_table collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /length\\\(trim\\\(entity_table\\\)\\\) between 1 and 120/
  );
  assert.match(pgTap, /tab in audit_logs entity_table is rejected/);
  assert.match(pgTap, /DEL in audit_logs entity_table is rejected/);
});

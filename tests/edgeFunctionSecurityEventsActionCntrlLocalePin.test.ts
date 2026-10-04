import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261004210000_mise_005hi_edge_function_security_events_action_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalFoundation = readFileSync(
  new URL(
    "../supabase/migrations/20260627053512_edge_function_firewall.sql",
    import.meta.url
  ),
  "utf8"
);
const writerBound = readFileSync(
  new URL(
    "../supabase/migrations/20260713100023_harden_workflow_authority.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/edge_function_security_events_action_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005HI pins edge_function_security_events.action CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005HI"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint edge_function_security_events_action_check check \(\s*length\(trim\(action\)\) between 1 and 160\s*and action collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );
  assert.ok(
    migration.includes(`action collate "C" !~ '[[:cntrl:]]'`),
    "action CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(action)) between 1 and 160"),
    "exact length(trim) bound must include the writer 160 ceiling"
  );

  // Compose: CHECK-only. Do not rewrite writers, policy, or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /create trigger/i);
  assert.doesNotMatch(sqlBody, /edge_function_policy/i);
  assert.doesNotMatch(sqlBody, /reserve_edge_function_invocation/i);
  assert.doesNotMatch(sqlBody, /record_edge_function_security_event/i);
  assert.doesNotMatch(
    sqlBody,
    /add constraint edge_function_security_events_function_name_check/,
    "must not reattach function_name CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint edge_function_security_events_event_type_check/,
    "must not reattach event_type CHECK by name rewrite"
  );
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.mise_actions/i);
  assert.match(
    migration,
    /not ilike '%function_name%'/,
    "must leave function_name bounds untouched when dropping prior action CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%event_type%'/,
    "must leave event_type bounds untouched when dropping prior action CHECKs"
  );
  assert.match(
    migration,
    /edge_function_security_events_function_name_check/,
    "must explicitly guard the function_name CHECK name from #486"
  );
  assert.match(
    migration,
    /edge_function_security_events_event_type_check/,
    "must explicitly guard the event_type CHECK name from #487"
  );
});

test("original edge action CHECK was length(trim) > 0 without cntrl or 160 ceiling", () => {
  assert.match(
    originalFoundation,
    /action text not null check \(length\(trim\(action\)\) > 0\)/
  );
  assert.doesNotMatch(
    originalFoundation,
    /action text not null check \(length\(trim\(action\)\) > 0\)[\s\S]{0,80}\[\[:cntrl:\]\]/
  );
  assert.doesNotMatch(
    originalFoundation,
    /action text not null check \(length\(trim\(action\)\) between 1 and 160/
  );
  assert.match(
    writerBound,
    /nullif\(trim\(action_name\), ''\) is null or length\(action_name\) > 160/
  );
  assert.match(writerBound, /trim\(action_name\)/);
});

test("length(trim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedEdgeFunctionAction = (value: string) => {
    return (
      value.trim().length >= 1 &&
      value.trim().length <= 160 &&
      !/[\u0000-\u001f\u007f]/.test(value)
    );
  };

  assert.equal(isAllowedEdgeFunctionAction("supplier_email_blocked"), true);
  assert.equal(isAllowedEdgeFunctionAction("function_error"), true);
  assert.equal(isAllowedEdgeFunctionAction("a".repeat(160)), true);
  assert.equal(isAllowedEdgeFunctionAction("a".repeat(161)), false);
  assert.equal(isAllowedEdgeFunctionAction(""), false);
  assert.equal(isAllowedEdgeFunctionAction("   "), false);
  assert.equal(isAllowedEdgeFunctionAction("supplier\temail"), false);
  assert.equal(isAllowedEdgeFunctionAction("supplier\nemail"), false);
  assert.equal(isAllowedEdgeFunctionAction("supplier\u007femail"), false);
});

test("pgTAP plan is derived from assertion call sites, not from a passing run", () => {
  const planMatch = pgTap.match(/select plan\((\d+)\);/);
  assert.ok(planMatch, "pgTAP file must declare an explicit plan");
  const planned = Number(planMatch[1]);

  const assertionCalls = [
    ...pgTap.matchAll(
      /^\s*select\s+(ok|is|matches|throws_ok|lives_ok|isnt|alike|throws_like)\s*\(/gim
    ),
  ];
  assert.equal(
    planned,
    assertionCalls.length,
    `plan(${planned}) must equal ${assertionCalls.length} assertion call sites counted from source`
  );

  assert.match(pgTap, /action collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(pgTap, /length\\\(trim\\\(action\\\)\\\) between 1 and 160/);
  assert.match(pgTap, /edge function_name CHECK remains attachable/);
  assert.match(pgTap, /action CHECK stays dedicated \(excludes event_type\)/);
  assert.match(pgTap, /tab in edge action is rejected under COLLATE C/);
  assert.match(pgTap, /DEL in edge action is rejected under COLLATE C/);
});

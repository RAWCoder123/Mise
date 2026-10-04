import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261004170000_mise_005he_finding_edited_recommended_action_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/20260728192830_append_operational_finding_decisions.sql",
    import.meta.url
  ),
  "utf8"
);
const domain = readFileSync(
  new URL("../services/domain/operationalFindingDecisions.ts", import.meta.url),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/operational_finding_decisions_edited_recommended_action_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005HE pins edited_recommended_action CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005HE"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint operational_finding_decisions_edited_recommended_action_check\s+check \(\s*edited_recommended_action is null\s*or \(\s*length\(trim\(edited_recommended_action\)\) between 1 and 320\s*and edited_recommended_action collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );
  assert.ok(
    migration.includes(
      `edited_recommended_action collate "C" !~ '[[:cntrl:]]'`
    ),
    "edited_recommended_action CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes(
      "length(trim(edited_recommended_action)) between 1 and 320"
    ),
    "exact length(trim) bound must match writer / domain 320 ceiling"
  );
  assert.ok(
    migration.includes("edited_recommended_action is null"),
    "edited_recommended_action is nullable; dedicated CHECK must keep null OR"
  );

  // Compose: dedicated CHECK-only. Do not rewrite writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /record_operational_finding_decision/i);
  assert.doesNotMatch(
    sqlBody,
    /operational_finding_decision_edit_check/,
    "must not reattach edit-shape CHECK by name rewrite"
  );
  assert.doesNotMatch(sqlBody, /original_recommended_action collate/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.operational_issues/i);
  assert.doesNotMatch(sqlBody, /alter table public\.action_outcomes/i);
  assert.doesNotMatch(sqlBody, /alter table public\.supplier_orders/i);
  assert.doesNotMatch(
    sqlBody,
    /\^[a-z0-9_]+/,
    "must not expand to charset allowlist; cntrl-only tip"
  );
  assert.match(
    migration,
    /not ilike '%decision_type%'/,
    "must leave edit-shape / decision_type untouched when dropping prior CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%original_recommended_action%'/,
    "must leave original_recommended_action / edit-shape untouched when dropping prior CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%finding_id%'/,
    "must leave finding_id bounds untouched when dropping prior CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%policy_version%'/,
    "must leave policy_version bounds untouched when dropping prior CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%finding_category%'/,
    "must leave finding_category allowlist untouched when dropping prior CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%severity%'/,
    "must leave severity allowlist untouched when dropping prior CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%evidence%'/,
    "must leave evidence bounds untouched when dropping prior CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%client_event_id%'/,
    "must leave client_event_id bounds untouched when dropping prior CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%idempotency_key%'/,
    "must leave idempotency_key bounds untouched when dropping prior CHECKs"
  );
});

test("original edited_recommended_action had no dedicated CHECK; edit-shape and writers bound to 320", () => {
  assert.match(
    original,
    /edited_recommended_action text,/
  );
  assert.doesNotMatch(
    original,
    /edited_recommended_action text[^\n]*check/i
  );
  assert.doesNotMatch(
    original,
    /operational_finding_decisions_edited_recommended_action_check/
  );
  assert.doesNotMatch(
    original,
    /edited_recommended_action[\s\S]*?\[\[:cntrl:\]\]/
  );

  assert.match(original, /nullif\(trim\(p_edited_recommended_action\), ''\)/);
  assert.match(
    domain,
    /requireBoundedText\(\s*input\.editedRecommendedAction,\s*"Edited recommended action",\s*320\s*\)/
  );

  const editCheckMatch = original.match(
    /constraint operational_finding_decision_edit_check check \(\s*\(\s*decision_type = 'edited'[\s\S]*?decision_type in \('approved', 'dismissed'\)[\s\S]*?edited_recommended_action is null\s*\)\s*\)/
  );
  assert.ok(
    editCheckMatch,
    "append migration must attach operational_finding_decision_edit_check"
  );
  assert.match(editCheckMatch[0], /\boriginal_recommended_action\b/);
  assert.match(editCheckMatch[0], /\bedited_recommended_action\b/);
  assert.match(editCheckMatch[0], /\bdecision_type\b/);
  assert.match(
    editCheckMatch[0],
    /length\(trim\(coalesce\(edited_recommended_action, ''\)\)\) between 1 and 320/
  );
  assert.doesNotMatch(editCheckMatch[0], /\[\[:cntrl:\]\]/);
});

test("nullable length(trim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedEditedRecommendedAction = (value: string | null) =>
    value === null ||
    (value.trim().length >= 1 &&
      value.trim().length <= 320 &&
      !/[\u0000-\u001f\u007f]/.test(value));

  assert.equal(isAllowedEditedRecommendedAction(null), true);
  assert.equal(
    isAllowedEditedRecommendedAction("Review 30 lb after recounting."),
    true
  );
  assert.equal(isAllowedEditedRecommendedAction("a".repeat(320)), true);
  assert.equal(isAllowedEditedRecommendedAction("a".repeat(321)), false);
  assert.equal(isAllowedEditedRecommendedAction(""), false);
  assert.equal(isAllowedEditedRecommendedAction("   "), false);
  assert.equal(
    isAllowedEditedRecommendedAction("Review\t30 lb after recounting."),
    false
  );
  assert.equal(
    isAllowedEditedRecommendedAction("Review\n30 lb after recounting."),
    false
  );
  assert.equal(
    isAllowedEditedRecommendedAction("Review\u007f30 lb after recounting."),
    false
  );
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

  assert.match(
    pgTap,
    /edited_recommended_action collate "C" !~ ''\[\[:cntrl:\]\]''/
  );
  assert.match(
    pgTap,
    /length\\\(trim\\\(edited_recommended_action\\\)\\\) between 1 and 320/
  );
  assert.match(pgTap, /edited_recommended_action is null/);
  assert.match(
    pgTap,
    /operational_finding_decision_edit_check remains attached/
  );
  assert.match(
    pgTap,
    /edited_recommended_action CHECK stays dedicated \(excludes edit-shape\)/
  );
  assert.match(pgTap, /tab in finding edited_recommended_action is rejected/);
  assert.match(pgTap, /DEL in finding edited_recommended_action is rejected/);
});

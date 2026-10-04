import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261004160000_mise_005hd_finding_original_recommended_action_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/operational_finding_decisions_original_recommended_action_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005HD pins original_recommended_action CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005HD"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint operational_finding_decisions_original_recommended_action_check\s+check \(\s*length\(trim\(original_recommended_action\)\) between 1 and 320\s*and original_recommended_action collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );
  assert.ok(
    migration.includes(
      `original_recommended_action collate "C" !~ '[[:cntrl:]]'`
    ),
    "original_recommended_action CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes(
      "length(trim(original_recommended_action)) between 1 and 320"
    ),
    "exact length(trim) bound must match writer / domain 320 ceiling"
  );
  assert.ok(
    !migration.includes("original_recommended_action is null"),
    "original_recommended_action is NOT NULL; dedicated CHECK must not add a null OR branch"
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
  assert.doesNotMatch(sqlBody, /edited_recommended_action collate/i);
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
    /not ilike '%edited_recommended_action%'/,
    "must leave edit-shape / edited action untouched when dropping prior CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%decision_type%'/,
    "must leave edit-shape / decision_type untouched when dropping prior CHECKs"
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

test("original finding original_recommended_action had length-only CHECK; writers trim to 320; edit-shape mentions original without cntrl", () => {
  assert.match(
    original,
    /original_recommended_action text not null\s+check \(length\(trim\(original_recommended_action\)\) between 1 and 320\)/
  );
  assert.doesNotMatch(
    original,
    /original_recommended_action[\s\S]*?\[\[:cntrl:\]\]/
  );
  assert.doesNotMatch(
    original,
    /operational_finding_decisions_original_recommended_action_check/
  );

  assert.match(original, /trim\(p_original_recommended_action\)/);
  assert.match(
    domain,
    /requireBoundedText\(\s*input\.finding\.recommendedAction,\s*"Finding recommended action",\s*320\s*\)/
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
  assert.doesNotMatch(editCheckMatch[0], /\[\[:cntrl:\]\]/);
  assert.doesNotMatch(
    editCheckMatch[0],
    /length\(trim\(original_recommended_action\)\)/
  );
});

test("NOT NULL length(trim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedOriginalRecommendedAction = (value: string) =>
    value.trim().length >= 1 &&
    value.trim().length <= 320 &&
    !/[\u0000-\u001f\u007f]/.test(value);

  assert.equal(
    isAllowedOriginalRecommendedAction("Review 38 lb inventory variance."),
    true
  );
  assert.equal(isAllowedOriginalRecommendedAction("a".repeat(320)), true);
  assert.equal(isAllowedOriginalRecommendedAction("a".repeat(321)), false);
  assert.equal(isAllowedOriginalRecommendedAction(""), false);
  assert.equal(isAllowedOriginalRecommendedAction("   "), false);
  assert.equal(
    isAllowedOriginalRecommendedAction("Review\t38 lb inventory variance."),
    false
  );
  assert.equal(
    isAllowedOriginalRecommendedAction("Review\n38 lb inventory variance."),
    false
  );
  assert.equal(
    isAllowedOriginalRecommendedAction("Review\u007f38 lb inventory variance."),
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
    /original_recommended_action collate "C" !~ ''\[\[:cntrl:\]\]''/
  );
  assert.match(
    pgTap,
    /length\\\(trim\\\(original_recommended_action\\\)\\\) between 1 and 320/
  );
  assert.match(
    pgTap,
    /operational_finding_decision_edit_check remains attached/
  );
  assert.match(
    pgTap,
    /original_recommended_action CHECK stays dedicated \(excludes edit-shape\)/
  );
  assert.match(
    pgTap,
    /tab in finding original_recommended_action is rejected/
  );
  assert.match(
    pgTap,
    /DEL in finding original_recommended_action is rejected/
  );
});

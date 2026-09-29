import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930120000_mise_005cx_mise_actions_action_type_execution_mode_status_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalBound = readFileSync(
  new URL(
    "../supabase/migrations/20260802204120_operational_backend_foundation.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/mise_actions_action_type_execution_mode_status_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005CX pins mise_actions action_type execution_mode status CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005CX"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint mise_actions_action_type_check\s+check \(\s*action_type in \(\s*'create_internal_task',[\s\S]*?'measure_outcome'\s*\)\s*and action_type collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint mise_actions_execution_mode_check\s+check \(\s*execution_mode in \('observe', 'recommend', 'prepare', 'execute'\)\s*and execution_mode collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint mise_actions_status_check\s+check \(\s*status in \(\s*'prepared',[\s\S]*?'unverified'\s*\)\s*and status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`action_type collate "C" ~ '${TOKEN_PATTERN}'`),
    "action_type CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes(`execution_mode collate "C" ~ '${TOKEN_PATTERN}'`),
    "execution_mode CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes(`status collate "C" ~ '${TOKEN_PATTERN}'`),
    "status CHECK must pin under COLLATE C"
  );

  assert.ok(
    migration.includes("'create_internal_task'") &&
      migration.includes("'recalculate_forecast'") &&
      migration.includes("'update_prep_recommendation'") &&
      migration.includes("'schedule_inventory_count'") &&
      migration.includes("'remind_employee'") &&
      migration.includes("'flag_menu_item_internally'") &&
      migration.includes("'prepare_supplier_order_draft'") &&
      migration.includes("'send_supplier_order'") &&
      migration.includes("'change_schedule'") &&
      migration.includes("'contact_external_party'") &&
      migration.includes("'modify_menu_availability'") &&
      migration.includes("'change_price'") &&
      migration.includes("'send_staff_communication'") &&
      migration.includes("'send_supplier_communication'") &&
      migration.includes("'issue_refund_or_credit'") &&
      migration.includes("'change_permissions_or_rules'") &&
      migration.includes("'prepare_inventory_adjustment'") &&
      migration.includes("'measure_outcome'"),
    "exact action_type allowlist must be preserved"
  );
  assert.ok(
    migration.includes("'observe'") &&
      migration.includes("'recommend'") &&
      migration.includes("'prepare'") &&
      migration.includes("'execute'"),
    "exact execution_mode allowlist must be preserved"
  );
  assert.ok(
    migration.includes("'prepared'") &&
      migration.includes("'waiting_for_approval'") &&
      migration.includes("'approved'") &&
      migration.includes("'rejected'") &&
      migration.includes("'executing'") &&
      migration.includes("'executed'") &&
      migration.includes("'failed'") &&
      migration.includes("'cancelled'") &&
      migration.includes("'reversed'") &&
      migration.includes("'unverified'"),
    "exact status allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /approve_mise_action/i);
  assert.doesNotMatch(sqlBody, /mark_supplier_send_action_failure/i);
  assert.doesNotMatch(sqlBody, /idempotency_key/i);
  assert.doesNotMatch(sqlBody, /error_code/i);
  assert.doesNotMatch(sqlBody, /autonomy_level/i);
  assert.doesNotMatch(sqlBody, /alter table public\.action_outcomes/i);
  assert.doesNotMatch(sqlBody, /alter table public\.operational_issues/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_autonomy_rules/i);
});

test("original mise_actions action_type execution_mode status used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /action_type text not null check \(action_type in \(\s*'create_internal_task', 'recalculate_forecast', 'update_prep_recommendation',\s*'schedule_inventory_count', 'remind_employee', 'flag_menu_item_internally',\s*'prepare_supplier_order_draft', 'send_supplier_order', 'change_schedule',\s*'contact_external_party', 'modify_menu_availability', 'change_price',\s*'send_staff_communication', 'send_supplier_communication',\s*'issue_refund_or_credit', 'change_permissions_or_rules',\s*'prepare_inventory_adjustment', 'measure_outcome'\s*\)\)/
  );
  assert.match(
    originalBound,
    /execution_mode text not null check \(execution_mode in \('observe', 'recommend', 'prepare', 'execute'\)\)/
  );
  assert.match(
    originalBound,
    /status text not null check \(status in \(\s*'prepared', 'waiting_for_approval', 'approved', 'rejected', 'executing',\s*'executed', 'failed', 'cancelled', 'reversed', 'unverified'\s*\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /action_type collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    originalBound,
    /execution_mode collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    originalBound,
    /status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins mise_actions action_type execution_mode status to COLLATE C", () => {
  assert.match(pgTap, /select plan\(56\)/);
  assert.match(pgTap, /mise_actions_action_type_check exists/);
  assert.match(pgTap, /mise_actions action_type CHECK keeps exact allowlist/);
  assert.match(pgTap, /mise_actions action_type CHECK uses COLLATE C/);
  assert.match(pgTap, /mise_actions_execution_mode_check exists/);
  assert.match(pgTap, /mise_actions execution_mode CHECK keeps exact allowlist/);
  assert.match(pgTap, /mise_actions execution_mode CHECK uses COLLATE C/);
  assert.match(pgTap, /mise_actions_status_check exists/);
  assert.match(pgTap, /mise_actions status CHECK keeps exact allowlist/);
  assert.match(pgTap, /mise_actions status CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token create_internal_task matches under COLLATE C/);
  assert.match(pgTap, /writer token recalculate_forecast matches under COLLATE C/);
  assert.match(pgTap, /writer token update_prep_recommendation matches under COLLATE C/);
  assert.match(pgTap, /writer token schedule_inventory_count matches under COLLATE C/);
  assert.match(pgTap, /writer token remind_employee matches under COLLATE C/);
  assert.match(pgTap, /writer token flag_menu_item_internally matches under COLLATE C/);
  assert.match(pgTap, /writer token prepare_supplier_order_draft matches under COLLATE C/);
  assert.match(pgTap, /writer token send_supplier_order matches under COLLATE C/);
  assert.match(pgTap, /writer token change_schedule matches under COLLATE C/);
  assert.match(pgTap, /writer token contact_external_party matches under COLLATE C/);
  assert.match(pgTap, /writer token modify_menu_availability matches under COLLATE C/);
  assert.match(pgTap, /writer token change_price matches under COLLATE C/);
  assert.match(pgTap, /writer token send_staff_communication matches under COLLATE C/);
  assert.match(pgTap, /writer token send_supplier_communication matches under COLLATE C/);
  assert.match(pgTap, /writer token issue_refund_or_credit matches under COLLATE C/);
  assert.match(pgTap, /writer token change_permissions_or_rules matches under COLLATE C/);
  assert.match(pgTap, /writer token prepare_inventory_adjustment matches under COLLATE C/);
  assert.match(pgTap, /writer token measure_outcome matches under COLLATE C/);
  assert.match(pgTap, /spaced action_type token is rejected under COLLATE C/);
  assert.match(pgTap, /empty action_type token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated action_type token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII action_type token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted action_type tokens match under COLLATE C/);
  assert.match(pgTap, /writer token observe matches under COLLATE C/);
  assert.match(pgTap, /writer token recommend matches under COLLATE C/);
  assert.match(pgTap, /writer token prepare matches under COLLATE C/);
  assert.match(pgTap, /writer token execute matches under COLLATE C/);
  assert.match(pgTap, /spaced execution_mode token is rejected under COLLATE C/);
  assert.match(pgTap, /empty execution_mode token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated execution_mode token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII execution_mode token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted execution_mode tokens match under COLLATE C/);
  assert.match(pgTap, /writer token prepared matches under COLLATE C/);
  assert.match(pgTap, /writer token waiting_for_approval matches under COLLATE C/);
  assert.match(pgTap, /writer token approved matches under COLLATE C/);
  assert.match(pgTap, /writer token rejected matches under COLLATE C/);
  assert.match(pgTap, /writer token executing matches under COLLATE C/);
  assert.match(pgTap, /writer token executed matches under COLLATE C/);
  assert.match(pgTap, /writer token failed matches under COLLATE C/);
  assert.match(pgTap, /writer token cancelled matches under COLLATE C/);
  assert.match(pgTap, /writer token reversed matches under COLLATE C/);
  assert.match(pgTap, /writer token unverified matches under COLLATE C/);
  assert.match(pgTap, /spaced status token is rejected under COLLATE C/);
  assert.match(pgTap, /empty status token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated status token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII status token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted status tokens match under COLLATE C/);
});

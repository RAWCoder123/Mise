import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930140000_mise_005cz_activity_events_vocabulary_locale_pin.sql",
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
const sharedTasks = readFileSync(
  new URL(
    "../supabase/migrations/20260802222329_shared_restaurant_tasks.sql",
    import.meta.url
  ),
  "utf8"
);
const purchaseLineLedger = readFileSync(
  new URL(
    "../supabase/migrations/20260903120000_mise_004c_purchase_line_ledger.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/activity_events_vocabulary_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005CZ pins activity_events event_type category actor_type status CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005CZ"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint activity_events_event_type_check\s+check \(\s*event_type in \(\s*'forecast_updated',[\s\S]*?'purchase_line_confidence_downgraded'\s*\)\s*and event_type collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint activity_events_category_check\s+check \(\s*category in \(\s*'inventory',\s*'orders',\s*'sales',\s*'team',\s*'tasks',\s*'waste',\s*'approvals',\s*'integrations',\s*'memory',\s*'system'\s*\)\s*and category collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint activity_events_actor_type_check\s+check \(\s*actor_type in \(\s*'mise',\s*'user',\s*'integration',\s*'system'\s*\)\s*and actor_type collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint activity_events_status_check\s+check \(\s*status in \(\s*'monitoring',[\s\S]*?'reversed'\s*\)\s*and status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`event_type collate "C" ~ '${TOKEN_PATTERN}'`),
    "event_type CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes(`category collate "C" ~ '${TOKEN_PATTERN}'`),
    "category CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes(`actor_type collate "C" ~ '${TOKEN_PATTERN}'`),
    "actor_type CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes(`status collate "C" ~ '${TOKEN_PATTERN}'`),
    "status CHECK must pin under COLLATE C"
  );

  assert.ok(
    migration.includes("'forecast_updated'") &&
      migration.includes("'prep_plan_updated'") &&
      migration.includes("'inventory_risk_detected'") &&
      migration.includes("'physical_count_requested'") &&
      migration.includes("'supplier_prices_checked'") &&
      migration.includes("'order_prepared'") &&
      migration.includes("'order_approved'") &&
      migration.includes("'order_sent'") &&
      migration.includes("'supplier_confirmation_received'") &&
      migration.includes("'delivery_expected'") &&
      migration.includes("'delivery_logged'") &&
      migration.includes("'invoice_discrepancy_detected'") &&
      migration.includes("'waste_analysis_completed'") &&
      migration.includes("'staff_schedule_analyzed'") &&
      migration.includes("'staffing_gap_detected'") &&
      migration.includes("'pos_sync_completed'") &&
      migration.includes("'reservation_forecast_updated'") &&
      migration.includes("'customer_review_trend_detected'") &&
      migration.includes("'menu_item_performance_analyzed'") &&
      migration.includes("'task_created'") &&
      migration.includes("'task_completed'") &&
      migration.includes("'task_reopened'") &&
      migration.includes("'task_unblocked'") &&
      migration.includes("'automation_failed'") &&
      migration.includes("'approval_required'") &&
      migration.includes("'recommendation_created'") &&
      migration.includes("'recommendation_dismissed'") &&
      migration.includes("'recommendation_outcome_measured'") &&
      migration.includes("'restaurant_memory_updated'") &&
      migration.includes("'inventory_count_recorded'") &&
      migration.includes("'purchase_lines_recorded'") &&
      migration.includes("'purchase_line_confidence_downgraded'"),
    "exact event_type allowlist must be preserved"
  );
  assert.ok(
    migration.includes("'inventory'") &&
      migration.includes("'orders'") &&
      migration.includes("'sales'") &&
      migration.includes("'team'") &&
      migration.includes("'tasks'") &&
      migration.includes("'waste'") &&
      migration.includes("'approvals'") &&
      migration.includes("'integrations'") &&
      migration.includes("'memory'") &&
      migration.includes("'system'"),
    "exact category allowlist must be preserved"
  );
  assert.ok(
    migration.includes("'mise'") &&
      migration.includes("'user'") &&
      migration.includes("'integration'") &&
      migration.includes("'system'"),
    "exact actor_type allowlist must be preserved"
  );
  assert.ok(
    migration.includes("'monitoring'") &&
      migration.includes("'prepared'") &&
      migration.includes("'waiting_for_approval'") &&
      migration.includes("'scheduled'") &&
      migration.includes("'sent'") &&
      migration.includes("'confirmed'") &&
      migration.includes("'completed'") &&
      migration.includes("'failed'") &&
      migration.includes("'could_not_verify'") &&
      migration.includes("'partially_completed'") &&
      migration.includes("'cancelled'") &&
      migration.includes("'reversed'"),
    "exact status allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /append_activity_event/i);
  assert.doesNotMatch(sqlBody, /capture_recalculation_run_activity/i);
  assert.doesNotMatch(sqlBody, /append_restaurant_task_activity/i);
  assert.doesNotMatch(sqlBody, /ingest_purchase_lines/i);
  assert.doesNotMatch(sqlBody, /idempotency_key/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /alter table public\.mise_actions/i);
  assert.doesNotMatch(sqlBody, /alter table public\.operational_issues/i);
  assert.doesNotMatch(sqlBody, /alter table public\.action_outcomes/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_autonomy_rules/i);
});

test("original activity_events vocabulary used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /event_type text not null check \(event_type in \(\s*'forecast_updated', 'prep_plan_updated', 'inventory_risk_detected',\s*'physical_count_requested', 'supplier_prices_checked', 'order_prepared',\s*'order_approved', 'order_sent', 'supplier_confirmation_received',\s*'delivery_expected', 'delivery_logged', 'invoice_discrepancy_detected',\s*'waste_analysis_completed', 'staff_schedule_analyzed', 'staffing_gap_detected',\s*'pos_sync_completed', 'reservation_forecast_updated',\s*'customer_review_trend_detected', 'menu_item_performance_analyzed',\s*'task_created', 'task_completed', 'automation_failed', 'approval_required',\s*'recommendation_created', 'recommendation_dismissed',\s*'recommendation_outcome_measured', 'restaurant_memory_updated',\s*'inventory_count_recorded'\s*\)\)/
  );
  assert.match(
    originalBound,
    /category text not null check \(category in \(\s*'inventory', 'orders', 'sales', 'team', 'waste', 'approvals',\s*'integrations', 'memory', 'system'\s*\)\)/
  );
  assert.match(
    originalBound,
    /actor_type text not null default 'mise' check \(actor_type in \('mise', 'user', 'integration', 'system'\)\)/
  );
  assert.match(
    originalBound,
    /status text not null check \(status in \(\s*'monitoring', 'prepared', 'waiting_for_approval', 'scheduled', 'sent',\s*'confirmed', 'completed', 'failed', 'could_not_verify',\s*'partially_completed', 'cancelled', 'reversed'\s*\)\)/
  );
  assert.match(
    sharedTasks,
    /add constraint activity_events_category_check check \(category in \(\s*'inventory', 'orders', 'sales', 'team', 'tasks', 'waste', 'approvals',\s*'integrations', 'memory', 'system'\s*\)\)/
  );
  assert.match(
    purchaseLineLedger,
    /add constraint activity_events_event_type_check check \(event_type in \(\s*'forecast_updated', 'prep_plan_updated', 'inventory_risk_detected',\s*'physical_count_requested', 'supplier_prices_checked', 'order_prepared',\s*'order_approved', 'order_sent', 'supplier_confirmation_received',\s*'delivery_expected', 'delivery_logged', 'invoice_discrepancy_detected',\s*'waste_analysis_completed', 'staff_schedule_analyzed', 'staffing_gap_detected',\s*'pos_sync_completed', 'reservation_forecast_updated',\s*'customer_review_trend_detected', 'menu_item_performance_analyzed',\s*'task_created', 'task_completed', 'task_reopened', 'task_unblocked',\s*'automation_failed', 'approval_required', 'recommendation_created',\s*'recommendation_dismissed', 'recommendation_outcome_measured',\s*'restaurant_memory_updated', 'inventory_count_recorded',\s*'purchase_lines_recorded', 'purchase_line_confidence_downgraded'\s*\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /event_type collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    originalBound,
    /category collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    originalBound,
    /actor_type collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    originalBound,
    /status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    sharedTasks,
    /category collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    purchaseLineLedger,
    /event_type collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins activity_events vocabulary to COLLATE C", () => {
  assert.match(pgTap, /select plan\(90\)/);
  assert.match(pgTap, /activity_events_event_type_check exists/);
  assert.match(pgTap, /activity_events event_type CHECK keeps exact allowlist/);
  assert.match(pgTap, /activity_events event_type CHECK uses COLLATE C/);
  assert.match(pgTap, /activity_events_category_check exists/);
  assert.match(pgTap, /activity_events category CHECK keeps exact allowlist/);
  assert.match(pgTap, /activity_events category CHECK uses COLLATE C/);
  assert.match(pgTap, /activity_events_actor_type_check exists/);
  assert.match(pgTap, /activity_events actor_type CHECK keeps exact allowlist/);
  assert.match(pgTap, /activity_events actor_type CHECK uses COLLATE C/);
  assert.match(pgTap, /activity_events_status_check exists/);
  assert.match(pgTap, /activity_events status CHECK keeps exact allowlist/);
  assert.match(pgTap, /activity_events status CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token forecast_updated matches under COLLATE C/);
  assert.match(pgTap, /writer token prep_plan_updated matches under COLLATE C/);
  assert.match(pgTap, /writer token inventory_risk_detected matches under COLLATE C/);
  assert.match(pgTap, /writer token physical_count_requested matches under COLLATE C/);
  assert.match(pgTap, /writer token supplier_prices_checked matches under COLLATE C/);
  assert.match(pgTap, /writer token order_prepared matches under COLLATE C/);
  assert.match(pgTap, /writer token order_approved matches under COLLATE C/);
  assert.match(pgTap, /writer token order_sent matches under COLLATE C/);
  assert.match(pgTap, /writer token supplier_confirmation_received matches under COLLATE C/);
  assert.match(pgTap, /writer token delivery_expected matches under COLLATE C/);
  assert.match(pgTap, /writer token delivery_logged matches under COLLATE C/);
  assert.match(pgTap, /writer token invoice_discrepancy_detected matches under COLLATE C/);
  assert.match(pgTap, /writer token waste_analysis_completed matches under COLLATE C/);
  assert.match(pgTap, /writer token staff_schedule_analyzed matches under COLLATE C/);
  assert.match(pgTap, /writer token staffing_gap_detected matches under COLLATE C/);
  assert.match(pgTap, /writer token pos_sync_completed matches under COLLATE C/);
  assert.match(pgTap, /writer token reservation_forecast_updated matches under COLLATE C/);
  assert.match(pgTap, /writer token customer_review_trend_detected matches under COLLATE C/);
  assert.match(pgTap, /writer token menu_item_performance_analyzed matches under COLLATE C/);
  assert.match(pgTap, /writer token task_created matches under COLLATE C/);
  assert.match(pgTap, /writer token task_completed matches under COLLATE C/);
  assert.match(pgTap, /writer token task_reopened matches under COLLATE C/);
  assert.match(pgTap, /writer token task_unblocked matches under COLLATE C/);
  assert.match(pgTap, /writer token automation_failed matches under COLLATE C/);
  assert.match(pgTap, /writer token approval_required matches under COLLATE C/);
  assert.match(pgTap, /writer token recommendation_created matches under COLLATE C/);
  assert.match(pgTap, /writer token recommendation_dismissed matches under COLLATE C/);
  assert.match(pgTap, /writer token recommendation_outcome_measured matches under COLLATE C/);
  assert.match(pgTap, /writer token restaurant_memory_updated matches under COLLATE C/);
  assert.match(pgTap, /writer token inventory_count_recorded matches under COLLATE C/);
  assert.match(pgTap, /writer token purchase_lines_recorded matches under COLLATE C/);
  assert.match(pgTap, /writer token purchase_line_confidence_downgraded matches under COLLATE C/);
  assert.match(pgTap, /spaced event_type token is rejected under COLLATE C/);
  assert.match(pgTap, /empty event_type token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated event_type token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII event_type token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted event_type tokens match under COLLATE C/);
  assert.match(pgTap, /writer token inventory matches under COLLATE C/);
  assert.match(pgTap, /writer token orders matches under COLLATE C/);
  assert.match(pgTap, /writer token sales matches under COLLATE C/);
  assert.match(pgTap, /writer token team matches under COLLATE C/);
  assert.match(pgTap, /writer token tasks matches under COLLATE C/);
  assert.match(pgTap, /writer token waste matches under COLLATE C/);
  assert.match(pgTap, /writer token approvals matches under COLLATE C/);
  assert.match(pgTap, /writer token integrations matches under COLLATE C/);
  assert.match(pgTap, /writer token memory matches under COLLATE C/);
  assert.match(pgTap, /writer token system matches under COLLATE C/);
  assert.match(pgTap, /spaced category token is rejected under COLLATE C/);
  assert.match(pgTap, /empty category token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated category token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII category token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted category tokens match under COLLATE C/);
  assert.match(pgTap, /writer token mise matches under COLLATE C/);
  assert.match(pgTap, /writer token user matches under COLLATE C/);
  assert.match(pgTap, /writer token integration matches under COLLATE C/);
  assert.match(pgTap, /writer token system actor matches under COLLATE C/);
  assert.match(pgTap, /spaced actor_type token is rejected under COLLATE C/);
  assert.match(pgTap, /empty actor_type token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated actor_type token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII actor_type token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted actor_type tokens match under COLLATE C/);
  assert.match(pgTap, /writer token monitoring matches under COLLATE C/);
  assert.match(pgTap, /writer token prepared matches under COLLATE C/);
  assert.match(pgTap, /writer token waiting_for_approval matches under COLLATE C/);
  assert.match(pgTap, /writer token scheduled matches under COLLATE C/);
  assert.match(pgTap, /writer token sent matches under COLLATE C/);
  assert.match(pgTap, /writer token confirmed matches under COLLATE C/);
  assert.match(pgTap, /writer token completed matches under COLLATE C/);
  assert.match(pgTap, /writer token failed matches under COLLATE C/);
  assert.match(pgTap, /writer token could_not_verify matches under COLLATE C/);
  assert.match(pgTap, /writer token partially_completed matches under COLLATE C/);
  assert.match(pgTap, /writer token cancelled matches under COLLATE C/);
  assert.match(pgTap, /writer token reversed matches under COLLATE C/);
  assert.match(pgTap, /spaced status token is rejected under COLLATE C/);
  assert.match(pgTap, /empty status token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated status token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII status token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted status tokens match under COLLATE C/);
});

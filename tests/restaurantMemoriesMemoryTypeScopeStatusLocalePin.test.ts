import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930130000_mise_005cy_restaurant_memories_memory_type_scope_status_locale_pin.sql",
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
    "../supabase/tests/database/restaurant_memories_memory_type_scope_status_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005CY pins restaurant_memories memory_type scope status CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005CY"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint restaurant_memories_memory_type_check\s+check \(\s*memory_type in \(\s*'demand_pattern',[\s\S]*?'action_outcome'\s*\)\s*and memory_type collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint restaurant_memories_scope_check\s+check \(\s*scope in \(\s*'restaurant',\s*'location',\s*'supplier',\s*'item',\s*'team',\s*'service_period'\s*\)\s*and scope collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint restaurant_memories_status_check\s+check \(\s*status in \(\s*'active',\s*'confirmed',\s*'corrected',\s*'dismissed',\s*'forgotten',\s*'disabled'\s*\)\s*and status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`memory_type collate "C" ~ '${TOKEN_PATTERN}'`),
    "memory_type CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes(`scope collate "C" ~ '${TOKEN_PATTERN}'`),
    "scope CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes(`status collate "C" ~ '${TOKEN_PATTERN}'`),
    "status CHECK must pin under COLLATE C"
  );

  assert.ok(
    migration.includes("'demand_pattern'") &&
      migration.includes("'prep_habit'") &&
      migration.includes("'waste_pattern'") &&
      migration.includes("'supplier_reliability'") &&
      migration.includes("'staff_timing'") &&
      migration.includes("'safety_stock_preference'") &&
      migration.includes("'service_window'") &&
      migration.includes("'approval_preference'") &&
      migration.includes("'seasonal_effect'") &&
      migration.includes("'weather_effect'") &&
      migration.includes("'local_event_effect'") &&
      migration.includes("'menu_dependency'") &&
      migration.includes("'operational_exception'") &&
      migration.includes("'rejected_recommendation'") &&
      migration.includes("'edited_quantity'") &&
      migration.includes("'recurring_bottleneck'") &&
      migration.includes("'action_outcome'"),
    "exact memory_type allowlist must be preserved"
  );
  assert.ok(
    migration.includes("'restaurant'") &&
      migration.includes("'location'") &&
      migration.includes("'supplier'") &&
      migration.includes("'item'") &&
      migration.includes("'team'") &&
      migration.includes("'service_period'"),
    "exact scope allowlist must be preserved"
  );
  assert.ok(
    migration.includes("'active'") &&
      migration.includes("'confirmed'") &&
      migration.includes("'corrected'") &&
      migration.includes("'dismissed'") &&
      migration.includes("'forgotten'") &&
      migration.includes("'disabled'"),
    "exact status allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /decide_restaurant_memory/i);
  assert.doesNotMatch(sqlBody, /record_supplier_delivery/i);
  assert.doesNotMatch(sqlBody, /dedupe_key/i);
  assert.doesNotMatch(sqlBody, /alter table public\.mise_actions/i);
  assert.doesNotMatch(sqlBody, /alter table public\.operational_issues/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_autonomy_rules/i);
  assert.doesNotMatch(sqlBody, /alter table public\.action_outcomes/i);
});

test("original restaurant_memories memory_type scope status used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /memory_type text not null check \(memory_type in \(\s*'demand_pattern', 'prep_habit', 'waste_pattern', 'supplier_reliability',\s*'staff_timing', 'safety_stock_preference', 'service_window',\s*'approval_preference', 'seasonal_effect', 'weather_effect',\s*'local_event_effect', 'menu_dependency', 'operational_exception',\s*'rejected_recommendation', 'edited_quantity', 'recurring_bottleneck',\s*'action_outcome'\s*\)\)/
  );
  assert.match(
    originalBound,
    /scope text not null default 'restaurant' check \(scope in \('restaurant', 'location', 'supplier', 'item', 'team', 'service_period'\)\)/
  );
  assert.match(
    originalBound,
    /status text not null default 'active' check \(status in \(\s*'active', 'confirmed', 'corrected', 'dismissed', 'forgotten', 'disabled'\s*\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /memory_type collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    originalBound,
    /scope collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    originalBound,
    /status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins restaurant_memories memory_type scope status to COLLATE C", () => {
  assert.match(pgTap, /select plan\(53\)/);
  assert.match(pgTap, /restaurant_memories_memory_type_check exists/);
  assert.match(pgTap, /restaurant_memories memory_type CHECK keeps exact allowlist/);
  assert.match(pgTap, /restaurant_memories memory_type CHECK uses COLLATE C/);
  assert.match(pgTap, /restaurant_memories_scope_check exists/);
  assert.match(pgTap, /restaurant_memories scope CHECK keeps exact allowlist/);
  assert.match(pgTap, /restaurant_memories scope CHECK uses COLLATE C/);
  assert.match(pgTap, /restaurant_memories_status_check exists/);
  assert.match(pgTap, /restaurant_memories status CHECK keeps exact allowlist/);
  assert.match(pgTap, /restaurant_memories status CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token demand_pattern matches under COLLATE C/);
  assert.match(pgTap, /writer token prep_habit matches under COLLATE C/);
  assert.match(pgTap, /writer token waste_pattern matches under COLLATE C/);
  assert.match(pgTap, /writer token supplier_reliability matches under COLLATE C/);
  assert.match(pgTap, /writer token staff_timing matches under COLLATE C/);
  assert.match(pgTap, /writer token safety_stock_preference matches under COLLATE C/);
  assert.match(pgTap, /writer token service_window matches under COLLATE C/);
  assert.match(pgTap, /writer token approval_preference matches under COLLATE C/);
  assert.match(pgTap, /writer token seasonal_effect matches under COLLATE C/);
  assert.match(pgTap, /writer token weather_effect matches under COLLATE C/);
  assert.match(pgTap, /writer token local_event_effect matches under COLLATE C/);
  assert.match(pgTap, /writer token menu_dependency matches under COLLATE C/);
  assert.match(pgTap, /writer token operational_exception matches under COLLATE C/);
  assert.match(pgTap, /writer token rejected_recommendation matches under COLLATE C/);
  assert.match(pgTap, /writer token edited_quantity matches under COLLATE C/);
  assert.match(pgTap, /writer token recurring_bottleneck matches under COLLATE C/);
  assert.match(pgTap, /writer token action_outcome matches under COLLATE C/);
  assert.match(pgTap, /spaced memory_type token is rejected under COLLATE C/);
  assert.match(pgTap, /empty memory_type token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated memory_type token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII memory_type token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted memory_type tokens match under COLLATE C/);
  assert.match(pgTap, /writer token restaurant matches under COLLATE C/);
  assert.match(pgTap, /writer token location matches under COLLATE C/);
  assert.match(pgTap, /writer token supplier matches under COLLATE C/);
  assert.match(pgTap, /writer token item matches under COLLATE C/);
  assert.match(pgTap, /writer token team matches under COLLATE C/);
  assert.match(pgTap, /writer token service_period matches under COLLATE C/);
  assert.match(pgTap, /spaced scope token is rejected under COLLATE C/);
  assert.match(pgTap, /empty scope token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated scope token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII scope token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted scope tokens match under COLLATE C/);
  assert.match(pgTap, /writer token active matches under COLLATE C/);
  assert.match(pgTap, /writer token confirmed matches under COLLATE C/);
  assert.match(pgTap, /writer token corrected matches under COLLATE C/);
  assert.match(pgTap, /writer token dismissed matches under COLLATE C/);
  assert.match(pgTap, /writer token forgotten matches under COLLATE C/);
  assert.match(pgTap, /writer token disabled matches under COLLATE C/);
  assert.match(pgTap, /spaced status token is rejected under COLLATE C/);
  assert.match(pgTap, /empty status token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated status token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII status token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted status tokens match under COLLATE C/);
});

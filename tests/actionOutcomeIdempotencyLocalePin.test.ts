import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260927200000_mise_005aw_action_outcome_idempotency_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalFoundation = readFileSync(
  new URL(
    "../supabase/migrations/20260802204120_operational_backend_foundation.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/action_outcome_idempotency_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const miseActions = readFileSync(
  new URL("../services/domain/miseActions.ts", import.meta.url),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const IDEMPOTENCY_PATTERN = "^[A-Za-z0-9:_-]{1,240}$";

test("MISE-005AW pins mise_actions and action_outcomes idempotency_key CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005AW"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint mise_actions_idempotency_key_check check \(\s*idempotency_key collate "C" ~ '\^\[A-Za-z0-9:_-\]\{1,240\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint action_outcomes_idempotency_key_check check \(\s*idempotency_key collate "C" ~ '\^\[A-Za-z0-9:_-\]\{1,240\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`idempotency_key collate "C" ~ '${IDEMPOTENCY_PATTERN}'`),
    "idempotency_key CHECK must pin under COLLATE C"
  );

  // Compose: CHECK-only. Do not rewrite writers or sibling pins.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.operational_issues/i);
  assert.doesNotMatch(sqlBody, /mise_actions_error_code_check/i);
});

test("original action/outcome idempotency_key CHECKs were length-only", () => {
  assert.match(
    originalFoundation,
    /idempotency_key text not null check \(length\(trim\(idempotency_key\)\) between 1 and 240\),\s*correlation_id uuid not null default gen_random_uuid\(\)/
  );
  assert.match(
    originalFoundation,
    /idempotency_key text not null check \(length\(trim\(idempotency_key\)\) between 1 and 240\),\s*created_at timestamptz not null default now\(\),\s*unique \(restaurant_id, id\),\s*unique \(restaurant_id, idempotency_key\),\s*constraint action_outcomes_action_fkey/
  );
  assert.doesNotMatch(
    originalFoundation,
    /mise_actions_idempotency_key_check/
  );
  assert.doesNotMatch(
    originalFoundation,
    /action_outcomes_idempotency_key_check/
  );

  assert.match(
    originalFoundation,
    /format\('send_supplier_order:%s',\s*new\.id\)/
  );
  assert.match(
    originalFoundation,
    /format\('supplier_delivery_outcome:%s',\s*delivery_row\.id\)/
  );
  assert.match(
    miseActions,
    /return `\$\{restaurantId\.trim\(\)\}:\$\{actionType\}:\$\{subjectId\.trim\(\)\}`/
  );
});

test("pgTAP fixture pins action/outcome idempotency_key shape to COLLATE C", () => {
  assert.match(pgTap, /select plan\(12\)/);
  assert.match(pgTap, /mise_actions_idempotency_key_check exists/);
  assert.match(pgTap, /action_outcomes_idempotency_key_check exists/);
  assert.match(pgTap, /mise_actions idempotency_key CHECK uses COLLATE C/);
  assert.match(pgTap, /action_outcomes idempotency_key CHECK uses COLLATE C/);
  assert.match(pgTap, /mise_actions idempotency_key CHECK is not length-only/);
  assert.match(
    pgTap,
    /action_outcomes idempotency_key CHECK is not length-only/
  );
  assert.match(
    pgTap,
    /writer mise_actions send_supplier_order UUID mint matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /writer action_outcomes supplier_delivery_outcome UUID mint matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /demo mise_actions restaurantId:actionType:subject mint matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /fixture mise_actions hyphenated mint matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /spaced mise_actions idempotency_key is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /empty action_outcomes idempotency_key is rejected under COLLATE C/
  );
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260927220000_mise_005ay_supplier_confirmation_idempotency_locale_pin.sql",
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
    "../supabase/tests/database/supplier_confirmation_idempotency_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const foundationPgTap = readFileSync(
  new URL(
    "../supabase/tests/database/operational_backend_foundation.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const IDEMPOTENCY_PATTERN = "^[A-Za-z0-9:_+.-]{1,240}$";
const idempotencyRe = new RegExp(IDEMPOTENCY_PATTERN);

/** Mirrors confirmationClientIdForOrder once the manager confirmation tip lands. */
function confirmationClientIdForOrder(orderId: string, recordedAt: string) {
  return `mgr-confirm:${orderId.trim()}:${recordedAt.trim()}`;
}

function managerConfirmationIdempotencyKey(clientConfirmationId: string) {
  return `manager_confirmation:${clientConfirmationId.trim()}`;
}

test("MISE-005AY pins supplier_order_confirmations idempotency_key CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005AY"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint supplier_order_confirmations_idempotency_key_check check \(\s*idempotency_key collate "C" ~ '\^\[A-Za-z0-9:_\+\.-\]\{1,240\}\$'\s*\)/
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
  assert.doesNotMatch(sqlBody, /alter table public\.supplier_deliveries/i);
  assert.doesNotMatch(sqlBody, /alter table public\.mise_actions/i);
  assert.doesNotMatch(sqlBody, /alter table public\.action_outcomes/i);
});

test("original supplier_order_confirmations idempotency_key CHECK was length-only", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.supplier_order_confirmations \([\s\S]*?idempotency_key text not null check \(length\(trim\(idempotency_key\)\) between 1 and 240\),/
  );
  assert.doesNotMatch(
    originalFoundation,
    /supplier_order_confirmations_idempotency_key_check/
  );

  assert.match(
    originalFoundation,
    /left\(trim\(p_idempotency_key\),\s*240\)/
  );
  assert.match(foundationPgTap, /supplier-confirmation-1/);
});

test("writer mints match the pinned ASCII+ISO identity class", () => {
  const isoZ = "2026-09-27T22:00:45.045Z";
  const isoOffset = "2026-09-27T22:00:45.045+00:00";
  const orderId = "d0000000-0000-4000-8000-000000000201";

  const clientZ = confirmationClientIdForOrder(orderId, isoZ);
  const clientOffset = confirmationClientIdForOrder(orderId, isoOffset);
  const keyZ = managerConfirmationIdempotencyKey(clientZ);
  const keyOffset = managerConfirmationIdempotencyKey(clientOffset);

  assert.equal(clientZ, `mgr-confirm:${orderId}:${isoZ}`);
  assert.equal(clientOffset, `mgr-confirm:${orderId}:${isoOffset}`);
  assert.match(clientZ, idempotencyRe);
  assert.match(clientOffset, idempotencyRe);
  assert.match(keyZ, idempotencyRe);
  assert.match(keyOffset, idempotencyRe);

  assert.match("supplier-confirmation-1", idempotencyRe);

  assert.doesNotMatch("manager confirmation spaced", idempotencyRe);
  assert.doesNotMatch("manager_confirmation:café", idempotencyRe);
  assert.doesNotMatch("", idempotencyRe);
});

test("pgTAP fixture pins supplier_order_confirmations idempotency shape to COLLATE C", () => {
  assert.match(pgTap, /select plan\(10\)/);
  assert.match(
    pgTap,
    /supplier_order_confirmations_idempotency_key_check exists/
  );
  assert.match(
    pgTap,
    /supplier_order_confirmations idempotency_key CHECK uses COLLATE C/
  );
  assert.match(
    pgTap,
    /supplier_order_confirmations idempotency_key CHECK is not length-only/
  );
  assert.match(
    pgTap,
    /writer idempotency_key ISO Z mint matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /writer idempotency_key ISO offset mint matches under COLLATE C/
  );
  assert.match(pgTap, /fixture supplier-confirmation-1 matches under COLLATE C/);
  assert.match(
    pgTap,
    /client confirmation id ISO Z mint matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /spaced supplier_order_confirmations idempotency_key is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /non-ASCII supplier_order_confirmations idempotency_key is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /empty supplier_order_confirmations idempotency_key is rejected under COLLATE C/
  );
});

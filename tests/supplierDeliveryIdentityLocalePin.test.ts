import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { deliveryClientIdForOrder } from "../services/domain/supplierDelivery";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260927210000_mise_005ax_supplier_delivery_identity_locale_pin.sql",
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
    "../supabase/tests/database/supplier_delivery_identity_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const demoData = readFileSync(
  new URL("../services/demo/replaceableDemoData.ts", import.meta.url),
  "utf8"
);
const domain = readFileSync(
  new URL("../services/domain/supplierDelivery.ts", import.meta.url),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const CLIENT_ID_PATTERN = "^[A-Za-z0-9:_+.-]{1,200}$";
const IDEMPOTENCY_PATTERN = "^[A-Za-z0-9:_+.-]{1,240}$";
const clientIdRe = new RegExp(CLIENT_ID_PATTERN);
const idempotencyRe = new RegExp(IDEMPOTENCY_PATTERN);

test("MISE-005AX pins supplier_deliveries identity CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005AX"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint supplier_deliveries_client_delivery_id_check check \(\s*client_delivery_id collate "C" ~ '\^\[A-Za-z0-9:_\+\.-\]\{1,200\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint supplier_deliveries_idempotency_key_check check \(\s*idempotency_key collate "C" ~ '\^\[A-Za-z0-9:_\+\.-\]\{1,240\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`client_delivery_id collate "C" ~ '${CLIENT_ID_PATTERN}'`),
    "client_delivery_id CHECK must pin under COLLATE C"
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
  assert.doesNotMatch(sqlBody, /alter table public\.mise_actions/i);
  assert.doesNotMatch(sqlBody, /alter table public\.action_outcomes/i);
  assert.doesNotMatch(sqlBody, /alter table public\.operational_issues/i);
});

test("original supplier_deliveries identity CHECKs were length-only", () => {
  assert.match(
    originalFoundation,
    /client_delivery_id text not null check \(length\(trim\(client_delivery_id\)\) between 1 and 200\),\s*idempotency_key text not null check \(length\(trim\(idempotency_key\)\) between 1 and 240\),/
  );
  assert.doesNotMatch(
    originalFoundation,
    /supplier_deliveries_client_delivery_id_check/
  );
  assert.doesNotMatch(
    originalFoundation,
    /supplier_deliveries_idempotency_key_check/
  );

  assert.match(
    originalFoundation,
    /format\('supplier_delivery:%s',\s*left\(trim\(p_client_delivery_id\),\s*200\)\)/
  );
  assert.match(
    domain,
    /return `supplier_delivery:\$\{orderId\.trim\(\)\}:\$\{receivedAt\}`/
  );
  assert.match(demoData, /client_delivery_id:\s*"demo-delivery-pantry-1"/);
});

test("writer mints match the pinned ASCII+ISO identity class", () => {
  const isoZ = "2026-09-27T21:00:45.045Z";
  const isoOffset = "2026-09-27T21:00:45.045+00:00";
  const orderId = "d0000000-0000-4000-8000-000000000201";

  const mintZ = deliveryClientIdForOrder(orderId, isoZ);
  const mintOffset = deliveryClientIdForOrder(orderId, isoOffset);

  assert.equal(mintZ, `supplier_delivery:${orderId}:${isoZ}`);
  assert.equal(mintOffset, `supplier_delivery:${orderId}:${isoOffset}`);
  assert.match(mintZ, clientIdRe);
  assert.match(mintOffset, clientIdRe);

  assert.match("demo-delivery-pantry-1", clientIdRe);
  assert.match("operational-delivery-1", clientIdRe);

  assert.match(`supplier_delivery:${mintZ}`, idempotencyRe);
  assert.match(`supplier_delivery:${mintOffset}`, idempotencyRe);

  assert.doesNotMatch("supplier delivery spaced", clientIdRe);
  assert.doesNotMatch("supplier_delivery:café", clientIdRe);
  assert.doesNotMatch("", idempotencyRe);
});

test("pgTAP fixture pins supplier_deliveries identity shape to COLLATE C", () => {
  assert.match(pgTap, /select plan\(14\)/);
  assert.match(pgTap, /supplier_deliveries_client_delivery_id_check exists/);
  assert.match(pgTap, /supplier_deliveries_idempotency_key_check exists/);
  assert.match(pgTap, /supplier_deliveries client_delivery_id CHECK uses COLLATE C/);
  assert.match(pgTap, /supplier_deliveries idempotency_key CHECK uses COLLATE C/);
  assert.match(
    pgTap,
    /supplier_deliveries client_delivery_id CHECK is not length-only/
  );
  assert.match(
    pgTap,
    /supplier_deliveries idempotency_key CHECK is not length-only/
  );
  assert.match(
    pgTap,
    /writer client_delivery_id ISO Z mint matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /writer client_delivery_id ISO offset mint matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /demo client_delivery_id hyphenated mint matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /fixture client_delivery_id hyphenated mint matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /writer idempotency_key embedding ISO client id matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /spaced supplier_deliveries client_delivery_id is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /non-ASCII supplier_deliveries client_delivery_id is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /empty supplier_deliveries idempotency_key is rejected under COLLATE C/
  );
});

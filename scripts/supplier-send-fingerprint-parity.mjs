import assert from "node:assert/strict";

import pg from "pg";

import {
  fingerprintSupplierSendSnapshot,
  serializeSupplierSendSnapshot,
} from "../services/domain/supplierSendContent.ts";

const { Client } = pg;

const connectionString = process.env.SUPABASE_LOCAL_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const connectionUrl = new URL(connectionString);
if (!["127.0.0.1", "localhost"].includes(connectionUrl.hostname)) {
  throw new Error("Supplier-send fingerprint parity must run against local Supabase");
}

const actorId = "fc111111-1111-4111-8111-111111111111";
const restaurantId = "fc000000-0000-4000-8000-000000000001";
const adversarialOrderId = "fc000000-0000-4000-8000-000000000101";
const boundaryOrderId = "fc000000-0000-4000-8000-000000000102";
const adversarialSupplierId = "fc000000-0000-4000-8000-000000000201";
const boundarySupplierId = "fc000000-0000-4000-8000-000000000202";
const encoder = new TextEncoder();

function byteLength(value) {
  return encoder.encode(value).byteLength;
}

function orderBody(supplierName, itemNames, operatorNote) {
  const lines = itemNames
    .slice()
    .sort()
    .map((itemName) => `${itemName} - 1 each`)
    .join("\n");
  return `Order draft for ${supplierName}\n\n${lines}` +
    "\n\nDelivery requested: Tomorrow morning" +
    (operatorNote ? `\n\nNotes:\n${operatorNote.trim()}` : "");
}

async function readBuiltSnapshot(client, orderId) {
  const result = await client.query(
    `with built as (
       select private.build_supplier_send_content($1, $2) as value
     )
     select (value->>'ready')::boolean as ready,
       value->'blockerCodes' as blocker_codes,
       value->'content' as content,
       (value->'content')::text as serialized,
       value->>'contentFingerprint' as fingerprint
     from built`,
    [restaurantId, orderId],
  );
  assert.equal(result.rowCount, 1);
  assert.equal(result.rows[0].ready, true, JSON.stringify(result.rows[0].blocker_codes));
  return result.rows[0];
}

async function assertParity(client, orderId, label) {
  const built = await readBuiltSnapshot(client, orderId);
  const serialized = serializeSupplierSendSnapshot(built.content);
  assert.equal(
    Buffer.from(serialized, "utf8").equals(Buffer.from(built.serialized, "utf8")),
    true,
    `${label}: TypeScript and PostgreSQL serialization bytes differ`,
  );
  assert.equal(
    await fingerprintSupplierSendSnapshot(built.content),
    built.fingerprint,
    `${label}: TypeScript and PostgreSQL SHA-256 differ`,
  );
  return built.content;
}

const client = new Client({ connectionString });
await client.connect();
try {
  await client.query("begin");
  await client.query("set local statement_timeout = '30s'");
  await client.query(
    `insert into auth.users (
       id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
       raw_app_meta_data, raw_user_meta_data, created_at, updated_at
     ) values (
       $1, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'supplier-send-parity@mise.test',
       crypt('password', gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       '{}'::jsonb, now(), now()
     )`,
    [actorId],
  );
  await client.query(
    "insert into public.restaurants (id, name, cuisine_type, timezone) values ($1, 'Parity Kitchen', 'Cafe', 'UTC')",
    [restaurantId],
  );
  await client.query(
    `insert into public.restaurant_email_connections (
       restaurant_id, provider, status, sender_email, last_verified_at
     ) values ($1, 'gmail', 'connected', 'orders@parity.test', clock_timestamp())`,
    [restaurantId],
  );
  await client.query(
    `insert into public.suppliers (id, restaurant_id, display_name, normalized_name)
     values ($2, $1, 'Parity Supplier', 'parity supplier'),
       ($3, $1, 'Boundary Supplier', 'boundary supplier')`,
    [restaurantId, adversarialSupplierId, boundarySupplierId],
  );
  await client.query(
    `insert into public.supplier_recipients (
       restaurant_id, supplier_id, supplier_name, email
     ) values ($1, $2, 'Parity Supplier', 'parity@supplier.test'),
       ($1, $3, 'Boundary Supplier', 'boundary@supplier.test')`,
    [restaurantId, adversarialSupplierId, boundarySupplierId],
  );

  await client.query(
    `insert into public.inventory_items (
       id, restaurant_id, item_name, category, unit, current_quantity,
       par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
       canonical_unit, canonical_quantity_per_unit,
       canonical_unit_verification_status, canonical_unit_verified_at,
       canonical_unit_verified_by
     ) values (
       'fc000000-0000-4001-8000-000000000001', $1, 'Parity item',
       'Test', 'each', 0, 1, 1, 1, $3, 'Parity Supplier',
       'each', 1, 'verified', now(), $2
     )`,
    [restaurantId, actorId, adversarialSupplierId],
  );
  await client.query(
    `insert into public.supplier_orders (
       id, restaurant_id, supplier_id, supplier_name, order_message, status, delivery_date
     ) values ($1, $2, $3, 'Parity Supplier', 'pending parity render', 'draft', current_date + 1)`,
    [adversarialOrderId, restaurantId, adversarialSupplierId],
  );
  await client.query(
    `insert into public.purchase_recommendations (
       id, restaurant_id, inventory_item_id, item_name, supplier_id, supplier_name,
       recommended_quantity, unit, reason, urgency, status,
       generation_source, supplier_order_id
     ) values (
       'fc000000-0000-4002-8000-000000000001', $1,
       'fc000000-0000-4001-8000-000000000001', 'Parity item',
       $3, 'Parity Supplier', 1, 'each', 'Fingerprint parity fixture',
       'high', 'approved', 'manual', $2
     )`,
    [restaurantId, adversarialOrderId, adversarialSupplierId],
  );
  const adversarialNote =
    "emoji 😀; CJK 漢字; CRLF\r\n; quote \"; backslash \\; " +
    "line separator \u2028; DEL \u007f; C0 \u0001\u001f";
  await client.query(
    "update public.supplier_orders set operator_note = $1 where restaurant_id = $2 and id = $3",
    [adversarialNote, restaurantId, adversarialOrderId],
  );
  await client.query(
    `update public.supplier_orders orders
     set order_message = private.build_supplier_order_message(
       orders.restaurant_id, orders.id, orders.supplier_name, orders.operator_note
     )
     where orders.restaurant_id = $1 and orders.id = $2`,
    [restaurantId, adversarialOrderId],
  );
  const adversarialContent = await assertParity(
    client,
    adversarialOrderId,
    "adversarial body",
  );
  assert.equal(adversarialContent.supplierId, adversarialSupplierId);
  assert.equal(adversarialContent.lines[0]?.supplierId, adversarialSupplierId);
  for (const required of ["😀", "漢字", "\r\n", '"', "\\", "\u2028", "\u007f", "\u0001", "\u001f"]) {
    assert.equal(adversarialContent.body.includes(required), true, `missing adversarial value ${JSON.stringify(required)}`);
  }

  const boundaryNames = Array.from({ length: 250 }, (_, index) =>
    `${String(index + 1).padStart(3, "0")}-${"界".repeat(80)}`
  );
  const itemIds = boundaryNames.map((_, index) =>
    `fc000000-0000-4001-8000-${String(index + 2).padStart(12, "0")}`
  );
  const recommendationIds = boundaryNames.map((_, index) =>
    `fc000000-0000-4002-8000-${String(index + 2).padStart(12, "0")}`
  );
  await client.query(
    `insert into public.inventory_items (
       id, restaurant_id, item_name, category, unit, current_quantity,
       par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
       canonical_unit, canonical_quantity_per_unit,
       canonical_unit_verification_status, canonical_unit_verified_at,
       canonical_unit_verified_by
     )
     select fixture.id, $1, fixture.item_name, 'Test', 'each', 0,
       1, 1, 1, $5, 'Boundary Supplier', 'each', 1, 'verified', now(), $2
     from unnest($3::uuid[], $4::text[]) as fixture(id, item_name)`,
    [restaurantId, actorId, itemIds, boundaryNames, boundarySupplierId],
  );
  await client.query(
    `insert into public.supplier_orders (
       id, restaurant_id, supplier_id, supplier_name, order_message, status, delivery_date
     ) values ($1, $2, $3, 'Boundary Supplier', 'pending boundary render', 'draft', current_date + 1)`,
    [boundaryOrderId, restaurantId, boundarySupplierId],
  );
  await client.query(
    `insert into public.purchase_recommendations (
       id, restaurant_id, inventory_item_id, item_name, supplier_id, supplier_name,
       recommended_quantity, unit, reason, urgency, status,
       generation_source, supplier_order_id
     )
     select fixture.recommendation_id, $1, fixture.inventory_item_id,
       fixture.item_name, $6, 'Boundary Supplier', 1, 'each',
       'Fingerprint boundary fixture', 'high', 'approved', 'manual', $2
     from unnest($3::uuid[], $4::uuid[], $5::text[])
       as fixture(recommendation_id, inventory_item_id, item_name)`,
    [
      restaurantId,
      boundaryOrderId,
      recommendationIds,
      itemIds,
      boundaryNames,
      boundarySupplierId,
    ],
  );
  const bodyWithoutNote = orderBody("Boundary Supplier", boundaryNames, null);
  const notePrefixBytes = byteLength("\n\nNotes:\n");
  const noteLength = 65_536 - byteLength(bodyWithoutNote) - notePrefixBytes;
  assert.equal(noteLength >= 1 && noteLength <= 2_000, true, `invalid boundary note length ${noteLength}`);
  const boundaryNote = "n".repeat(noteLength);
  assert.equal(byteLength(orderBody("Boundary Supplier", boundaryNames, boundaryNote)), 65_536);
  await client.query(
    "update public.supplier_orders set operator_note = $1 where restaurant_id = $2 and id = $3",
    [boundaryNote, restaurantId, boundaryOrderId],
  );
  await client.query(
    `update public.supplier_orders orders
     set order_message = private.build_supplier_order_message(
       orders.restaurant_id, orders.id, orders.supplier_name, orders.operator_note
     )
     where orders.restaurant_id = $1 and orders.id = $2`,
    [restaurantId, boundaryOrderId],
  );
  const boundaryContent = await assertParity(
    client,
    boundaryOrderId,
    "65536-byte body",
  );
  assert.equal(boundaryContent.supplierId, boundarySupplierId);
  assert.equal(
    boundaryContent.lines.every((line) => line.supplierId === boundarySupplierId),
    true,
  );
  assert.equal(byteLength(boundaryContent.body), 65_536);

  console.log(
    "Supplier-send fingerprint parity passed: adversarial snapshot and exact 65536-byte body matched PostgreSQL bytes and SHA-256.",
  );
} finally {
  await client.query("rollback").catch(() => undefined);
  await client.end();
}

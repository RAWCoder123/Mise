import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildSquareAuthorizationUrl,
  normalizeCatalogItem,
  normalizeOrderSales,
  searchSquareOrders,
  SQUARE_OAUTH_SCOPES,
  sha256Hex,
} from "../supabase/functions/_shared/square.ts";

const migration = readFileSync(
  "supabase/migrations/20260730210000_square_backend_oauth_sync.sql",
  "utf8",
);
const truthfulCountMigration = readFileSync(
  "supabase/migrations/20260814120000_square_sync_truthful_counts.sql",
  "utf8",
);
const squareDatabaseProof = readFileSync(
  "supabase/tests/database/square_sync_result.test.sql",
  "utf8",
);
const linkSquare = readFileSync("supabase/functions/link-square/index.ts", "utf8");
const syncPos = readFileSync("supabase/functions/sync-pos-sales/index.ts", "utf8");
const webhooks = readFileSync("supabase/functions/square-webhooks/index.ts", "utf8");
const config = readFileSync("supabase/config.toml", "utf8");

const oauthConfig = {
  applicationId: "sq0idp-test-application",
  applicationSecret: "server-only-square-secret",
  redirectUri: "https://project.supabase.co/functions/v1/square-oauth-callback",
  environment: "sandbox" as const,
};

test("Square OAuth URL requests merchant, catalog, and orders scopes without leaking the secret", async () => {
  const state = "state-token-with-at-least-thirty-two-bytes";
  const authorization = new URL(buildSquareAuthorizationUrl(oauthConfig, state));
  assert.equal(authorization.origin, "https://connect.squareupsandbox.com");
  assert.equal(authorization.searchParams.get("client_id"), oauthConfig.applicationId);
  assert.equal(authorization.searchParams.get("state"), state);
  assert.equal(authorization.searchParams.get("session"), "false");
  assert.deepEqual(
    authorization.searchParams.get("scope")?.split(" ").sort(),
    [...SQUARE_OAUTH_SCOPES].sort(),
  );
  assert.doesNotMatch(authorization.toString(), /server-only-square-secret/i);
  assert.equal(
    await sha256Hex("state"),
    "4ba69735ca53765ed6a709edb56c6ea236b7193a3b29a6b390c346f0f4340e4e",
  );
});

test("Square order and catalog normalizers produce bounded Mise sales and catalog rows", () => {
  const sales = normalizeOrderSales({
    id: "order-1",
    location_id: "loc-a",
    closed_at: "2026-07-30T12:00:00.000Z",
    line_items: [
      {
        uid: "line-1",
        name: "Burger",
        catalog_object_id: "var-1",
        quantity: "2",
        gross_sales_money: { amount: 2400, currency: "USD" },
        total_money: { amount: 2400, currency: "USD" },
      },
    ],
  });
  assert.equal(sales.length, 1);
  assert.equal(sales[0]?.item_name, "Burger");
  assert.equal(sales[0]?.quantity_sold, 2);
  assert.equal(sales[0]?.record_kind, "sale");
  assert.equal(sales[0]?.source_record_id, "square_order-1_line-1");
  assert.equal(sales[0]?.provider_location_id, "loc-a");
  assert.equal(sales[0]?.gross_sales, 24);
  assert.equal(sales[0]?.provider_variation_id, "var-1");

  const catalog = normalizeCatalogItem({
    type: "ITEM",
    id: "item-1",
    item_data: {
      name: "Burger",
      product_type: "REGULAR",
      variations: [
        {
          id: "var-1",
          item_variation_data: { name: "Regular" },
        },
      ],
    },
  });
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0]?.external_catalog_item_id, "item-1");
  assert.equal(catalog[0]?.external_name, "Burger");
});

test("Square order search exhausts pagination for every ten-location batch", async () => {
  const requests: Array<{ locationIds: string[]; cursor?: string }> = [];
  const fetchImpl: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as {
      location_ids: string[];
      cursor?: string;
    };
    requests.push({ locationIds: body.location_ids, cursor: body.cursor });
    const requestNumber = requests.length;
    const orderId = `order-${requestNumber}`;
    const payload = {
      orders: [{
        id: orderId,
        location_id: body.location_ids[0],
        closed_at: "2026-08-21T12:00:00.000Z",
        line_items: [{
          uid: `line-${requestNumber}`,
          name: "Burger",
          quantity: "1",
          gross_sales_money: { amount: 1200 },
          total_money: { amount: 1200 },
        }],
      }],
      ...(requestNumber === 1 ? { cursor: "first-batch-page-two" } : {}),
    };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const locationIds = Array.from({ length: 11 }, (_, index) => `location-${index + 1}`);
  const sales = await searchSquareOrders(
    { environment: "sandbox" },
    "square-access-token",
    locationIds,
    "2026-07-26",
    "2026-08-22",
    fetchImpl,
  );

  assert.equal(sales.length, 3);
  assert.deepEqual(requests, [
    { locationIds: locationIds.slice(0, 10), cursor: undefined },
    { locationIds: locationIds.slice(0, 10), cursor: "first-batch-page-two" },
    { locationIds: locationIds.slice(10), cursor: undefined },
  ]);
});

test("Square migration keeps credentials private and kill-switch gated", () => {
  assert.match(migration, /create table if not exists private\.square_oauth_flows/i);
  assert.match(migration, /create table if not exists private\.square_credentials/i);
  assert.match(migration, /revoke insert, update, delete on public\.pos_integrations from authenticated/i);
  assert.match(migration, /square_sync_enabled/i);
  assert.match(migration, /service_apply_square_sync_result/i);
  assert.match(migration, /'Square'/i);
  assert.match(migration, /source_pos/i);
  assert.match(migration, /'link-square',\s*'square-oauth-callback',\s*'square-webhooks'/i);
  assert.doesNotMatch(migration, /grant insert[\s\S]*pos_integrations[\s\S]*authenticated/i);
});

test("Square Edge Functions stay fail-closed until configured and enabled", () => {
  assert.match(linkSquare, /service_begin_square_oauth/i);
  assert.match(linkSquare, /server_configuration_missing/i);
  assert.match(syncPos, /service_fetch_square_sync_credential/i);
  assert.match(syncPos, /provider_not_enabled/i);
  assert.match(syncPos, /service_apply_square_sync_result/i);
  assert.match(webhooks, /x-square-hmacsha256-signature/i);
  assert.match(webhooks, /service_resolve_square_webhook_merchant/i);
  assert.match(config, /\[functions\.link-square\][\s\S]*verify_jwt = true/i);
  assert.match(config, /\[functions\.square-oauth-callback\][\s\S]*verify_jwt = false/i);
  assert.match(config, /\[functions\.square-webhooks\][\s\S]*verify_jwt = false/i);
});

test("Square sync records truthful counts and database replay coverage", () => {
  assert.match(truthfulCountMigration, /processed_count integer := 0/i);
  assert.match(truthfulCountMigration, /records_processed = processed_count/i);
  assert.match(truthfulCountMigration, /'recordsProcessed', processed_count/i);
  assert.doesNotMatch(truthfulCountMigration, /records_processed = records_processed/i);
  assert.match(
    truthfulCountMigration,
    /on conflict \(restaurant_id, source_pos, source_record_id\)[\s\S]*do update/i,
  );
  assert.match(squareDatabaseProof, /an exact replay does not duplicate logical sales rows/i);
  assert.match(squareDatabaseProof, /the overlapping row is deduplicated/i);
  assert.match(squareDatabaseProof, /metadata->>'recordsProcessed'/i);
  assert.match(squareDatabaseProof, /provider_catalog_item_id.*provider_variation_id/i);
});

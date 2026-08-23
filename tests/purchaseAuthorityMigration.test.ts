import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260821120000_mise_003a_purchase_approval_authority.sql", import.meta.url),
  "utf8"
);
const correctionMigration = readFileSync(
  new URL("../supabase/migrations/20260822063410_mise_003a_authority_correction.sql", import.meta.url),
  "utf8"
);
const syncPos = readFileSync(new URL("../supabase/functions/sync-pos-sales/index.ts", import.meta.url), "utf8");
const squareWebhooks = readFileSync(new URL("../supabase/functions/square-webhooks/index.ts", import.meta.url), "utf8");
const posSettings = readFileSync(new URL("../app/settings/pos.tsx", import.meta.url), "utf8");

test("MISE-003A approval re-evaluates server authority before supplier mutation", () => {
  assert.match(migration, /create or replace function private\.evaluate_purchase_recommendation_authority/i);
  assert.match(migration, /create or replace function public\.approve_purchase_recommendation/i);
  assert.match(migration, /authority := private\.evaluate_purchase_recommendation_authority[\s\S]*if not coalesce[\s\S]*'outcome', 'blocked'[\s\S]*insert into public\.supplier_orders/i);
  assert.match(migration, /generation_source in \('mise_rules', 'legacy_client'\)[\s\S]*signals_revision is distinct from recommendation_row\.planning_revision/i);
  assert.match(migration, /p_evaluated_at - verified_count\.effective_at > interval '36 hours'/i);
  assert.match(migration, /p_evaluated_at - integration\.last_sync_at > interval '24 hours'/i);
  assert.match(migration, /draft_authority_incomplete[\s\S]*unattestedLineCount/i);
  assert.match(migration, /existing_order\.purchase_authority\s*\?\s*existing_line\.id::text/i);
  assert.doesNotMatch(migration, /service_claim_supplier_email_send/);
});

test("MISE-003A persists explicit Square-window and recipe revision authority", () => {
  assert.match(migration, /authority_window_from date[\s\S]*authority_window_completed_at timestamptz/i);
  assert.match(migration, /service_apply_square_sync_result[\s\S]*authority_window_from = p_from[\s\S]*authority_window_to = p_to/i);
  assert.match(migration, /delete from public\.pos_sales existing_sale[\s\S]*location\.pos_integration_id = p_integration_id[\s\S]*records_removed/i);
  assert.match(migration, /recipe_revision bigint[\s\S]*recipe_confirmed_revision bigint/i);
  assert.match(migration, /invalidate_menu_item_recipe_authority[\s\S]*recipe_revision = recipe_revision \+ 1[\s\S]*recipe_confirmed_revision = null/i);
  assert.match(migration, /confirm_recipe_complete[\s\S]*array\['owner', 'admin', 'manager'\]/i);
});

test("MISE-003A requires ledger-derived on-hand and keeps evidence bounded", () => {
  assert.match(migration, /authority_projected_quantity numeric/i);
  assert.match(migration, /fresh post-upgrade count is required/i);
  assert.match(migration, /jsonb_typeof\(approval_authority\) = 'object'[\s\S]*32768/i);
  assert.match(migration, /purchase_approval_blocked[\s\S]*blocker_codes/i);
  assert.doesNotMatch(migration, /raw.provider|credential|refresh_token|order_message.*approval_authority/i);
});

test("legacy application drafting cannot bypass the approval RPC", () => {
  const orders = readFileSync(new URL("../services/application/orders.ts", import.meta.url), "utf8");
  const generator = orders.match(/export async function generateSupplierOrderDraft[\s\S]*?\n}\n/)?.[0] ?? "";
  assert.match(generator, /created only by the server-authoritative recommendation approval workflow/i);
  assert.doesNotMatch(generator, /upsertSupplierOrderDraft|buildDraftsFromRecommendations/i);
});

test("MISE-003A correction treats zero rows as complete only after an exact fresh full snapshot", () => {
  assert.match(correctionMigration, /authority_sync_token uuid/i);
  assert.match(correctionMigration, /p_snapshot_mode = 'full'[\s\S]*p_from <> operating_date - 27[\s\S]*p_to <> operating_date/i);
  assert.match(correctionMigration, /square_configured[\s\S]*authority_window_from is distinct from operating_date - 27/i);
  assert.match(correctionMigration, /generation_source in \('mise_rules', 'legacy_client'\)[\s\S]*demand_history_insufficient/i);
  assert.match(correctionMigration, /'demandBasis', demand_basis/i);
  assert.match(posSettings, /toDateKeyInTimeZone\(new Date\(\), restaurant\.timezone\)[\s\S]*addDaysToDateKey\(to, -27\)/i);
});

test("MISE-003A correction revalidates the exact live draft set before any mutation", () => {
  assert.match(correctionMigration, /for existing_line in[\s\S]*evaluate_purchase_recommendation_authority\([\s\S]*draft_authority_stale/i);
  assert.match(correctionMigration, /draft_authority_stale[\s\S]*if not coalesce[\s\S]*insert into public\.supplier_orders/i);
  assert.match(correctionMigration, /purchase_authority = draft_authority_refresh[\s\S]*jsonb_build_object\(recommendation_row\.id::text, authority\)/i);
  assert.match(correctionMigration, /p_restaurant_id, existing_line\.id, evaluated_at/i);
});

test("Square full and webhook refreshes share a pre-fetch synchronization and identity boundary", () => {
  const beginInSync = syncPos.indexOf('"service_begin_square_authority_sync"');
  const fetchInSync = syncPos.indexOf("const tokens = await refreshSquareAccessToken(");
  const beginInWebhook = squareWebhooks.indexOf('"service_begin_square_authority_sync"');
  const fetchInWebhook = squareWebhooks.indexOf("const tokens = await refreshSquareAccessToken(");
  assert.ok(beginInSync >= 0 && beginInSync < fetchInSync);
  assert.ok(beginInWebhook >= 0 && beginInWebhook < fetchInWebhook);
  assert.match(syncPos, /service_apply_square_sync_result_scoped[\s\S]*p_snapshot_mode: "full"/i);
  assert.match(squareWebhooks, /service_apply_square_sync_result_scoped[\s\S]*p_snapshot_mode: "partial"/i);
  assert.doesNotMatch(syncPos, /enrichSquareSalesWithCatalogIdentity/);
  assert.doesNotMatch(squareWebhooks, /enrichSquareSalesWithCatalogIdentity/);
  assert.match(correctionMigration, /derived_catalog_item_id[\s\S]*disagrees with the catalog snapshot/i);
  assert.match(correctionMigration, /p_snapshot_mode = 'partial'[\s\S]*authority_window_from = case[\s\S]*then null/i);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260821120000_mise_003a_purchase_approval_authority.sql", import.meta.url),
  "utf8"
);

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

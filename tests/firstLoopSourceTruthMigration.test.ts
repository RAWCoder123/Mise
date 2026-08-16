import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260816023936_first_loop_source_truth.sql",
  "utf8"
);

test("source-truth migration records complete Square identity and exactly one planning location", () => {
  for (const column of [
    "occurred_at timestamptz",
    "pos_location_id uuid",
    "external_catalog_item_id text",
    "external_variation_id text"
  ]) {
    assert.match(migration, new RegExp(`add column if not exists ${column}`, "i"));
  }
  assert.match(migration, /pos_locations_one_planning_location_per_integration/i);
  assert.match(migration, /pos_catalog_item_mappings_current_provider_identity_key/i);
  assert.match(migration, /row_number\(\) over[\s\S]*verification_status = 'verified'/i);
  assert.match(migration, /where selected_for_planning/i);
  assert.match(migration, /Select exactly one active Square location before syncing/i);
});

test("catalog verification is a role-checked manager workflow", () => {
  assert.match(migration, /create or replace function public\.review_pos_catalog_mapping/i);
  assert.match(migration, /private\.has_restaurant_role\([\s\S]*owner[\s\S]*admin[\s\S]*manager/i);
  assert.match(migration, /verification_status = 'verified'/i);
  assert.match(migration, /recipe_versions[\s\S]*recipe_ingredients/i);
  assert.match(migration, /revoke all on function public\.review_pos_catalog_mapping[\s\S]*public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.review_pos_catalog_mapping[\s\S]*to authenticated/i);
});

test("recommendations carry bounded non-null confidence and provenance", () => {
  assert.match(migration, /add column if not exists confidence text not null default 'blocked'/i);
  assert.match(migration, /add column if not exists source_evidence jsonb not null/i);
  assert.match(migration, /octet_length\(source_evidence::text\) <= 16384/i);
  assert.match(migration, /jsonb_array_length\(source_evidence -> 'mappingIds'\) <= 100/i);
  assert.match(migration, /set confidence = 'blocked'[\s\S]*'mode', 'legacy'/i);
});

test("approval, draft preparation, and send authorization all revalidate provenance", () => {
  assert.match(migration, /create or replace function private\.recommendation_source_is_current/i);
  assert.match(migration, /create or replace function private\.order_recommendation_sources_are_current/i);
  assert.match(migration, /create or replace function public\.approve_purchase_recommendation[\s\S]*recommendation_source_is_current/i);
  assert.match(migration, /create or replace function public\.approve_supplier_send_envelope[\s\S]*order_recommendation_sources_are_current/i);
  assert.match(migration, /create or replace function private\.service_claim_supplier_email_send[\s\S]*order_recommendation_sources_are_current/i);
  assert.match(migration, /'bodyHash', current_body_hash/i);
  assert.match(migration, /count_row\.effective_at > now\(\) \+ interval '5 minutes'/i);
  assert.match(migration, /canonical_unit_verification_status = 'verified'[\s\S]*item\.canonical_unit = count_row\.canonical_unit/i);
  assert.match(migration, /old\.status = 'pending' and new\.status = 'approved'[\s\S]*should_bump := false/i);
  assert.match(migration, /bump_recommendation_history_revision\(\)[\s\S]*mise\.inventory_event_tenant_delete/i);
});

test("future inventory events are rejected at the database boundary", () => {
  assert.match(migration, /create or replace function private\.reject_future_inventory_event/i);
  assert.match(migration, /new\.effective_at > clock_timestamp\(\) \+ interval '5 minutes'/i);
  assert.match(migration, /create trigger reject_future_inventory_event[\s\S]*before insert on public\.inventory_events/i);
  assert.match(migration, /revoke all on function private\.reject_future_inventory_event\(\)[\s\S]*service_role/i);
});

test("private planning authority is service-only and count-event based", () => {
  assert.match(migration, /create or replace function private\.fetch_operational_planning_snapshot/i);
  assert.match(migration, /event_type = 'count'[\s\S]*effective_at/i);
  assert.match(migration, /revoke all on function private\.fetch_operational_planning_snapshot[\s\S]*public, anon, authenticated, service_role/i);
  assert.match(migration, /grant execute on function private\.fetch_operational_planning_snapshot[\s\S]*to service_role/i);
  assert.match(migration, /revoke all on function private\.recommendation_source_is_current[\s\S]*public, anon, authenticated, service_role/i);
  assert.match(migration, /revoke all on function public\.create_pending_purchase_recommendation[\s\S]*public, anon, authenticated, service_role/i);
});

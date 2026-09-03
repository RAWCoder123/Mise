import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PURCHASE_LINE_PACK_UNITS,
  PURCHASE_LINE_PACK_PATTERN
} from "../services/domain/purchaseLines";

const migration = readFileSync(
  new URL("../supabase/migrations/20260903120000_mise_004c_purchase_line_ledger.sql", import.meta.url),
  "utf8"
);
const securityGate = readFileSync(new URL("../scripts/security-backend.mjs", import.meta.url), "utf8");
const tenantIsolation = readFileSync(
  new URL("../supabase/tests/database/tenant_isolation.test.sql", import.meta.url),
  "utf8"
);

test("the ledger is tenant-scoped, RLS-backed, and read-only to clients", () => {
  assert.match(migration, /create table if not exists public\.purchase_lines/);
  assert.match(migration, /restaurant_id uuid not null references public\.restaurants\(id\) on delete cascade/);
  assert.match(migration, /alter table public\.purchase_lines enable row level security/);
  assert.match(
    migration,
    /create policy "Members can read purchase lines"[\s\S]*for select to authenticated[\s\S]*private\.is_restaurant_member\(restaurant_id\)/
  );
  assert.match(
    migration,
    /revoke all on table public\.purchase_lines from public, anon, authenticated, service_role/
  );
  assert.match(migration, /grant select on public\.purchase_lines to authenticated;/);
  assert.doesNotMatch(migration, /grant[^;]*\b(insert|update|delete)\b[^;]*on\s+(?:table\s+)?public\.purchase_lines[^;]*to authenticated/i);
});

test("the ledger is append-only with only tenant-cascade and actor-anonymization escapes", () => {
  assert.match(migration, /raise exception 'Purchase lines are append-only'/);
  assert.match(
    migration,
    /before update or delete on public\.purchase_lines\nfor each row execute function private\.reject_purchase_line_mutation/
  );
  assert.match(migration, /mise\.inventory_event_tenant_delete/);
  assert.match(migration, /old\.recorded_by is not null[\s\S]*new\.recorded_by is null/);
  // A correction is a new row referencing the old one, never an edit.
  assert.match(migration, /supersedes_line_id uuid/);
  assert.match(
    migration,
    /create unique index if not exists purchase_lines_supersedes_once_idx[\s\S]*where supersedes_line_id is not null/
  );
  const updates = migration.match(/update public\.purchase_lines set [^;]+;/gi) ?? [];
  assert.equal(updates.length, 1, "the ledger may contain only the direction backfill");
  assert.match(
    updates[0]!,
    /update public\.purchase_lines set line_type = 'purchase' where line_type is null;/
  );
  assert.ok(
    migration.indexOf(updates[0]!) <
      migration.indexOf("create trigger reject_purchase_line_update_delete"),
    "the backfill must run before the append-only trigger exists"
  );
  assert.match(
    migration,
    /alter table public\.purchase_lines alter column line_type set not null;/,
    "direction is backfilled explicitly and then required, never defaulted"
  );
  assert.doesNotMatch(migration, /delete from public\.purchase_lines/i);
});

test("ingestion is idempotent on the stated key and writes only through the RPC", () => {
  assert.match(
    migration,
    /constraint purchase_lines_document_line_key unique \(\s*restaurant_id, supplier_scope, source_document_reference, line_index, revision\s*\)/
  );
  // A null supplier still deduplicates rather than escaping the key.
  assert.match(migration, /supplier_scope uuid generated always as \(\s*coalesce\(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid\)\s*\) stored/);
  assert.match(migration, /on conflict on constraint purchase_lines_document_line_key do nothing/);
  assert.match(
    migration,
    /create or replace function public\.ingest_purchase_lines[\s\S]*security definer[\s\S]*set search_path = ''/
  );
  assert.match(migration, /grant execute on function public\.ingest_purchase_lines\(uuid, text, text, jsonb, uuid, uuid\)\nto authenticated/);
  assert.match(migration, /has_restaurant_role\(\s*p_restaurant_id, array\['owner', 'admin', 'manager'\]::text\[\]\s*\)/);
  assert.match(migration, /Supplier identity is not available for this restaurant/);
  assert.match(migration, /was submitted twice/);
});

test("parse failures stay visible and are never defaulted", () => {
  // Confidence is the lowest of three ceilings: what was claimed, what the
  // document carried, and what the line's own numbers support.
  assert.match(
    migration,
    /create or replace function private\.resolve_purchase_line_confidence[\s\S]*select case least\([\s\S]*purchase_line_confidence_rank\(p_requested\)[\s\S]*then 'could_not_verify'[\s\S]*purchase_line_consistency_ceiling\(p_flags\)/
  );
  assert.match(
    migration,
    /purchase_line_consistency_ceiling[\s\S]*'extended_price_mismatch', 'pack_unit_dimension_conflict'\]::text\[\][\s\S]*then 'could_not_verify'[\s\S]*cardinality\(p_flags\) > 0 then 'estimated'/
  );
  // A contradiction cannot be written as confirmed by any path.
  assert.match(
    migration,
    /constraint purchase_lines_consistency_confidence_check check \([\s\S]*parse_confidence = 'confirmed'\s*and pg_catalog\.cardinality\(consistency_flags\) = 0/
  );
  // The tolerance is derived from rounding rather than picked.
  assert.match(migration, /> 0\.01 \+ p_quantity \* 0\.005/);
  // Downgrades are named, not merely counted.
  assert.match(migration, /'purchase_line_confidence_downgraded'/);
  assert.match(migration, /purchase_line_flag_label/);
  assert.match(migration, /could not keep their stated confidence/);
  assert.match(
    migration,
    /constraint purchase_lines_confidence_check check \(\s*parse_confidence = 'could_not_verify'/
  );
  assert.match(migration, /parse_confidence in \('confirmed', 'estimated', 'could_not_verify'\)/);
  assert.match(
    migration,
    /source in \('invoice', 'order_confirmation', 'manual_entry', 'credit_memo'\)/
  );
  // A credit is a stated direction, never a negative number.
  assert.match(migration, /line_type text check \(line_type in \('purchase', 'credit'\)\)/);
  assert.match(migration, /quantity is null or \(quantity >= 0/);
  assert.match(migration, /unit_price is null or \(unit_price >= 0/);
  assert.match(migration, /extended_price is null or \(extended_price >= 0/);
  assert.match(
    migration,
    /signed_quantity numeric generated always as \(\s*case when line_type = 'credit' then -quantity else quantity end\s*\) stored/
  );
  // A credit link is optional, never unique, and never overloads supersession.
  assert.match(migration, /credits_line_id uuid,/);
  assert.match(migration, /purchase_lines_credits_fkey foreign key \(restaurant_id, credits_line_id\)/);
  assert.doesNotMatch(migration, /unique index[^;]*credits_line_id/i);
  // Every ingestion emits a truthful activity record naming what it could not verify.
  assert.match(migration, /'purchase_lines_recorded'/);
  assert.match(migration, /could not be verified\./);
  assert.match(migration, /'purchase_line_ingestion:' \|\| correlation::text/);
  assert.match(migration, /'purchase_lines_ingested', 'purchase_lines'/);
});

test("MISE-004C stores substrate only and takes no operational action", () => {
  // Scan executable SQL, not prose: the activity vocabulary must restate every
  // existing event type to extend it additively, and the header comment names
  // the behaviors this ledger deliberately does not have.
  const ledger = migration
    .replace(/--[^\n]*/g, "")
    .replace(
      /add constraint activity_events_event_type_check check \(event_type in \([\s\S]*?\)\);/,
      ""
    );
  for (const forbidden of [
    /reorder/i,
    /forecast/i,
    /depletion/i,
    /recommend/i,
    /purchase_recommendations/i,
    /supplier_orders/i,
    /inventory_events/i,
    /similarity|levenshtein|trigram|pg_trgm|embedding|cluster/i
  ]) {
    assert.doesNotMatch(ledger, forbidden, `ledger must not reference ${forbidden}`);
  }
  // The ledger writes its own table, its activity record, and its audit row.
  const writes = [...ledger.matchAll(/(?:insert into|update|delete from)\s+(public\.[a-z_]+)/gi)]
    .map((match) => match[1]!.toLowerCase());
  assert.deepEqual(
    [...new Set(writes)].sort(),
    ["public.audit_logs", "public.purchase_lines"],
    "MISE-003 purchasing tables must stay untouched"
  );
});

test("SQL and TypeScript share one normalization contract", () => {
  const sqlUnits = migration
    .match(/select 'bottles\|[\s\S]*?';/)?.[0]
    .replace(/select |[|]{2}|['"];?|\s/g, "")
    .split("|")
    .filter(Boolean);
  assert.deepEqual(
    sqlUnits,
    [...PURCHASE_LINE_PACK_UNITS],
    "the pack unit vocabulary must be identical in both runtimes"
  );
  // Longest-first ordering is what makes the two engines agree on `lbs` vs `lb`.
  for (let index = 1; index < PURCHASE_LINE_PACK_UNITS.length; index += 1) {
    const previous = PURCHASE_LINE_PACK_UNITS[index - 1]!;
    const current = PURCHASE_LINE_PACK_UNITS[index]!;
    assert.ok(
      previous.length >= current.length,
      `pack units must be longest-first: ${previous} precedes ${current}`
    );
  }
  assert.ok(PURCHASE_LINE_PACK_PATTERN.includes("[/x]"));
  assert.match(migration, /\[ \]\*\[\/x\]\[ \]\*/, "both runtimes accept `6/1gal` and `6 x 1 gal`");
  assert.match(migration, /'mise\.purchase_line_normalization\.v1'/);
  assert.match(migration, /\[\^\[:alnum:\]\]\+/, "punctuation is stripped after pack extraction");
});

test("the ledger is registered with the tenant and security inventories", () => {
  assert.match(securityGate, /"purchase_lines"/);
  const restaurantOwned = securityGate.match(/const restaurantOwnedTables = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? "";
  assert.match(restaurantOwned, /"purchase_lines"/, "must be proven tenant-owned");
  const selectOnly = securityGate.match(/const selectOnlyAuthenticatedTables = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? "";
  assert.match(selectOnly, /"purchase_lines"/, "must be proven free of authenticated DML");
  assert.match(tenantIsolation, /'purchase_lines',/, "must be in the reviewed Data API allowlist");
});

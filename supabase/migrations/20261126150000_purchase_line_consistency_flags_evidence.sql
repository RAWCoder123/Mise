-- Purchase-line consistency_flags must match the recorded line evidence.
--
-- Hosted ingest/append always stores flags from
-- private.purchase_line_consistency_flags. Product normalizePurchaseLineInput
-- computes the same flags before the RPC. On current main, every other insert
-- path (direct service_role inserts, append helpers that skip the ingest
-- preflight, future writers) can still stamp arbitrary allowlisted
-- consistency_flags onto the append-only ledger because the existing column
-- CHECK only requires the array to be a subset of the four known flag labels.
--
-- Forged empty flags can hide an extended-price or pack-unit contradiction
-- beneath confirmed confidence. Forged flags can also invent a downgrade when
-- the line is internally consistent. Confidence ceilings and activity
-- downgrade summaries both trust the stored array.
--
-- Stated versus described pack wording is not stored as separate columns.
-- After coalesce into pack_size, the durable reconstruction is:
--   stated stand-in = stored pack_size
--   described = private.extract_purchase_pack_size(raw_item_description)
-- That reconstruction matches ingest outcomes for every flag the helper emits.
--
-- This migration fails closed at the database boundary for every insert path
-- when consistency_flags disagree with that reconstruction. Soft-empty and
-- allowlist cardinality stay with the existing column CHECK. Unpadded /
-- control-character / locale pins stay with their own tips. Does not rewrite
-- ingest_purchase_lines or append_purchase_line.
--
-- NOT VALID CHECKs skip validating any pre-existing rows so history is never
-- rewritten; new inserts are still enforced by the BEFORE INSERT trigger.
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation,
-- RLS, grants/revokes, and append-only behavior. Nothing is relaxed.

create or replace function private.purchase_line_expected_consistency_flags(
  p_quantity numeric,
  p_unit_of_measure text,
  p_pack_size text,
  p_unit_price numeric,
  p_extended_price numeric,
  p_transaction_date date,
  p_received_date date,
  p_raw_item_description text
)
returns text[]
language sql
immutable
security invoker
set search_path = ''
as $$
  select private.purchase_line_consistency_flags(
    p_quantity,
    p_unit_of_measure,
    p_pack_size,
    p_unit_price,
    p_extended_price,
    p_transaction_date,
    p_received_date,
    p_pack_size,
    private.extract_purchase_pack_size(p_raw_item_description)
  );
$$;

create or replace function private.enforce_purchase_line_consistency_flags_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  expected text[];
begin
  expected := private.purchase_line_expected_consistency_flags(
    new.quantity,
    new.unit_of_measure,
    new.pack_size,
    new.unit_price,
    new.extended_price,
    new.transaction_date,
    new.received_date,
    new.raw_item_description
  );

  if new.consistency_flags is distinct from expected then
    raise exception
      'Purchase line consistency flags must match the recorded line evidence'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists purchase_lines_consistency_flags_evidence
  on public.purchase_lines;
create trigger purchase_lines_consistency_flags_evidence
before insert on public.purchase_lines
for each row execute function private.enforce_purchase_line_consistency_flags_evidence();

revoke all on function private.purchase_line_expected_consistency_flags(
  numeric, text, text, numeric, numeric, date, date, text
) from public, anon, authenticated, service_role;

revoke all on function private.enforce_purchase_line_consistency_flags_evidence()
  from public, anon, authenticated, service_role;

comment on function private.purchase_line_expected_consistency_flags(
  numeric, text, text, numeric, numeric, date, date, text
) is
  'Reconstruct purchase_lines.consistency_flags from stored line evidence.';

comment on function private.enforce_purchase_line_consistency_flags_evidence() is
  'Fail closed: purchase_lines.consistency_flags must match recorded evidence.';

alter table public.purchase_lines
  drop constraint if exists purchase_lines_consistency_flags_match_check;
alter table public.purchase_lines
  add constraint purchase_lines_consistency_flags_match_check check (
    consistency_flags is not distinct from
      private.purchase_line_expected_consistency_flags(
        quantity,
        unit_of_measure,
        pack_size,
        unit_price,
        extended_price,
        transaction_date,
        received_date,
        raw_item_description
      )
  ) not valid;

comment on constraint purchase_lines_consistency_flags_match_check
  on public.purchase_lines is
  'consistency_flags must match recorded line evidence. NOT VALID skips legacy rows.';

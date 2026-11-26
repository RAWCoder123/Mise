-- Purchase-line unit_of_measure and pack_size must be null or unpadded.
--
-- Hosted `private.purchase_line_text` already btrims optional unit and pack
-- labels before append. On current main, every other insert path (direct
-- service_role inserts, append helpers that skip the ingest preflight, future
-- writers) can still stamp padded unit_of_measure or pack_size onto the
-- append-only ledger.
--
-- unit_of_measure is part of the netting group
-- (restaurant, supplier, normalized_item_key, unit_of_measure, currency).
-- Padding invents a parallel net group beside the trimmed label, so credits
-- and purchases that a human would call the same unit fail to net. Padded
-- pack_size similarly splits pack-unit dimension checks and provenance.
--
-- This migration fails closed at the database boundary for every insert path
-- when a present unit_of_measure or pack_size retains leading/trailing
-- whitespace. Null remains allowed. Soft-empty non-null values continue to
-- fail the existing length-after-trim CHECK. Length-only bounds and
-- control-character pins stay with their own tips. Does not rewrite
-- ingest_purchase_lines or append_purchase_line.
--
-- NOT VALID CHECKs skip validating any pre-existing rows so history is never
-- rewritten; new inserts are still enforced by the BEFORE INSERT trigger.
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation,
-- RLS, grants/revokes, and append-only behavior. Nothing is relaxed.

create or replace function private.enforce_purchase_line_unit_pack_unpadded_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.unit_of_measure is not null
     and new.unit_of_measure <> btrim(new.unit_of_measure) then
    raise exception
      'Purchase line unit of measure must be unpadded when present'
      using errcode = '22023';
  end if;

  if new.pack_size is not null
     and new.pack_size <> btrim(new.pack_size) then
    raise exception
      'Purchase line pack size must be unpadded when present'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists purchase_lines_unit_pack_unpadded_evidence
  on public.purchase_lines;
create trigger purchase_lines_unit_pack_unpadded_evidence
before insert on public.purchase_lines
for each row execute function private.enforce_purchase_line_unit_pack_unpadded_evidence();

revoke all on function private.enforce_purchase_line_unit_pack_unpadded_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_purchase_line_unit_pack_unpadded_evidence() is
  'Fail closed: purchase_lines.unit_of_measure and pack_size must be null or unpadded.';

alter table public.purchase_lines
  drop constraint if exists purchase_lines_unit_of_measure_unpadded_check;
alter table public.purchase_lines
  add constraint purchase_lines_unit_of_measure_unpadded_check check (
    unit_of_measure is null
    or unit_of_measure = btrim(unit_of_measure)
  ) not valid;

comment on constraint purchase_lines_unit_of_measure_unpadded_check
  on public.purchase_lines is
  'unit_of_measure must be null or unpadded. NOT VALID skips legacy rows.';

alter table public.purchase_lines
  drop constraint if exists purchase_lines_pack_size_unpadded_check;
alter table public.purchase_lines
  add constraint purchase_lines_pack_size_unpadded_check check (
    pack_size is null
    or pack_size = btrim(pack_size)
  ) not valid;

comment on constraint purchase_lines_pack_size_unpadded_check
  on public.purchase_lines is
  'pack_size must be null or unpadded. NOT VALID skips legacy rows.';

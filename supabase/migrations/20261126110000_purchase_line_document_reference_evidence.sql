-- Purchase-line source_document_reference must be non-blank and unpadded.
--
-- Hosted `public.ingest_purchase_lines` already nullif-trims
-- `p_source_document_reference` before append. On current main, every other
-- insert path (direct service_role inserts, append helpers that skip the
-- ingest preflight, future writers) can still stamp whitespace-only or padded
-- document references onto the append-only ledger.
--
-- source_document_reference is part of the durable idempotency key
-- (restaurant, supplier_scope, source_document_reference, line_index,
-- revision). Blank padding invents a parallel document identity beside the
-- trimmed label, so re-ingest of the same invoice can record duplicate lines
-- instead of settling as already-on-file.
--
-- This migration fails closed at the database boundary for every insert path
-- when source_document_reference is blank after trim, or when it retains
-- leading/trailing whitespace. Length-only bounds and control-character pins
-- stay with their own tips. Does not rewrite ingest_purchase_lines.
--
-- NOT VALID CHECKs skip validating any pre-existing rows so history is never
-- rewritten; new inserts are still enforced by the BEFORE INSERT trigger.
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation,
-- RLS, grants/revokes, and append-only behavior. Nothing is relaxed.

create or replace function private.enforce_purchase_line_document_reference_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.source_document_reference is null
     or btrim(new.source_document_reference) = ''
     or new.source_document_reference <> btrim(new.source_document_reference) then
    raise exception
      'Purchase line source document reference must be non-blank and unpadded'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists purchase_lines_document_reference_evidence
  on public.purchase_lines;
create trigger purchase_lines_document_reference_evidence
before insert on public.purchase_lines
for each row execute function private.enforce_purchase_line_document_reference_evidence();

revoke all on function private.enforce_purchase_line_document_reference_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_purchase_line_document_reference_evidence() is
  'Fail closed: purchase_lines.source_document_reference must be trimmed non-empty.';

alter table public.purchase_lines
  drop constraint if exists purchase_lines_source_document_reference_unpadded_check;
alter table public.purchase_lines
  add constraint purchase_lines_source_document_reference_unpadded_check check (
    btrim(source_document_reference) <> ''
    and source_document_reference = btrim(source_document_reference)
  ) not valid;

comment on constraint purchase_lines_source_document_reference_unpadded_check
  on public.purchase_lines is
  'source_document_reference must be trimmed non-empty. NOT VALID skips legacy rows.';

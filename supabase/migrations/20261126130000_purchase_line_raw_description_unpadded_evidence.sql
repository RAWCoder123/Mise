-- Purchase-line raw_item_description must be non-blank and unpadded.
--
-- Hosted `private.purchase_line_text` already btrims `rawItemDescription`
-- before append. Product `boundedText` also trims before normalize. On current
-- main, every other insert path (direct service_role inserts, append helpers
-- that skip the ingest preflight, future writers) can still stamp
-- whitespace-only or padded descriptions onto the append-only ledger because
-- the existing CHECK only requires length(btrim(...)) between 1 and 500.
--
-- raw_item_description is the durable source wording for the line and the
-- input to normalized_item_key. Padding invents provenance beside the hosted
-- trimmed store even when the normalized key still agrees.
--
-- This migration fails closed at the database boundary for every insert path
-- when raw_item_description is blank after trim, or when it retains
-- leading/trailing whitespace. Length-only bounds and control-character pins
-- stay with their own tips. Does not rewrite ingest_purchase_lines or
-- append_purchase_line.
--
-- NOT VALID CHECKs skip validating any pre-existing rows so history is never
-- rewritten; new inserts are still enforced by the BEFORE INSERT trigger.
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation,
-- RLS, grants/revokes, and append-only behavior. Nothing is relaxed.

create or replace function private.enforce_purchase_line_raw_description_unpadded_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.raw_item_description is null
     or btrim(new.raw_item_description) = ''
     or new.raw_item_description <> btrim(new.raw_item_description) then
    raise exception
      'Purchase line raw item description must be non-blank and unpadded'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists purchase_lines_raw_description_unpadded_evidence
  on public.purchase_lines;
create trigger purchase_lines_raw_description_unpadded_evidence
before insert on public.purchase_lines
for each row execute function private.enforce_purchase_line_raw_description_unpadded_evidence();

revoke all on function private.enforce_purchase_line_raw_description_unpadded_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_purchase_line_raw_description_unpadded_evidence() is
  'Fail closed: purchase_lines.raw_item_description must be trimmed non-empty.';

alter table public.purchase_lines
  drop constraint if exists purchase_lines_raw_item_description_unpadded_check;
alter table public.purchase_lines
  add constraint purchase_lines_raw_item_description_unpadded_check check (
    btrim(raw_item_description) <> ''
    and raw_item_description = btrim(raw_item_description)
  ) not valid;

comment on constraint purchase_lines_raw_item_description_unpadded_check
  on public.purchase_lines is
  'raw_item_description must be trimmed non-empty. NOT VALID skips legacy rows.';

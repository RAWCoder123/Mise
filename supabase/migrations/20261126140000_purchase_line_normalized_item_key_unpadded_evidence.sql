-- Purchase-line normalized_item_key must be null or unpadded.
--
-- Hosted append always stores the key from
-- private.normalize_purchase_item_key, which already btrims. Product
-- normalizePurchaseLineDescription also trims before returning a key. On
-- current main, every other insert path (direct service_role inserts, append
-- helpers that skip the ingest preflight, future writers) can still stamp a
-- padded normalized_item_key onto the append-only ledger because the existing
-- column CHECK only requires length(normalized_item_key) between 1 and 500.
--
-- normalized_item_key is part of the netting group
-- (restaurant, supplier, normalized_item_key, unit_of_measure, currency).
-- Padding invents a parallel net group beside the trimmed key, so credits and
-- purchases that a human would call the same item fail to net. The match CHECK
-- against normalize_purchase_item_key(raw_item_description) already refuses
-- mismatched keys with a generic violation; this tip fails closed with an
-- explicit unpadded contract for every insert path.
--
-- This migration fails closed at the database boundary for every insert path
-- when a present normalized_item_key retains leading/trailing whitespace. Null
-- remains allowed. Soft-empty non-null values continue to fail the existing
-- length CHECK. Length-only bounds and control-character / locale pins stay
-- with their own tips. Does not rewrite ingest_purchase_lines or
-- append_purchase_line. Does not weaken purchase_lines_normalized_key_check.
--
-- NOT VALID CHECKs skip validating any pre-existing rows so history is never
-- rewritten; new inserts are still enforced by the BEFORE INSERT trigger.
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation,
-- RLS, grants/revokes, and append-only behavior. Nothing is relaxed.

create or replace function private.enforce_purchase_line_normalized_item_key_unpadded_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.normalized_item_key is not null
     and new.normalized_item_key <> btrim(new.normalized_item_key) then
    raise exception
      'Purchase line normalized item key must be unpadded when present'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists purchase_lines_normalized_item_key_unpadded_evidence
  on public.purchase_lines;
create trigger purchase_lines_normalized_item_key_unpadded_evidence
before insert on public.purchase_lines
for each row execute function private.enforce_purchase_line_normalized_item_key_unpadded_evidence();

revoke all on function private.enforce_purchase_line_normalized_item_key_unpadded_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_purchase_line_normalized_item_key_unpadded_evidence() is
  'Fail closed: purchase_lines.normalized_item_key must be null or unpadded.';

alter table public.purchase_lines
  drop constraint if exists purchase_lines_normalized_item_key_unpadded_check;
alter table public.purchase_lines
  add constraint purchase_lines_normalized_item_key_unpadded_check check (
    normalized_item_key is null
    or normalized_item_key = btrim(normalized_item_key)
  ) not valid;

comment on constraint purchase_lines_normalized_item_key_unpadded_check
  on public.purchase_lines is
  'normalized_item_key must be null or unpadded. NOT VALID skips legacy rows.';

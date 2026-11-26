-- Purchase-line ledger inserts must carry a recorded_by actor.
--
-- `public.purchase_lines.recorded_by` is nullable so account-deletion
-- anonymization can clear only the deleted operator's auth identity while
-- preserving append-only business fields (ON DELETE SET NULL + the
-- append-only UPDATE escape in private.reject_purchase_line_mutation).
-- Hosted private.append_purchase_line stamps auth.uid(), but any insert path
-- that reaches the table can still mint an unattributable purchase or credit
-- row with recorded_by null.
--
-- This migration fails closed at the database boundary for every INSERT
-- (ingest_purchase_lines, supersede_purchase_line, future service inserts)
-- when recorded_by is null. Account-deletion anonymization UPDATEs remain
-- allowed — there is intentionally no NOT NULL CHECK, because a CHECK would
-- block the ON DELETE SET NULL escape.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, RLS, and append-only
-- behavior stay in place. Does not rewrite ingest_purchase_lines,
-- append_purchase_line, supersede_purchase_line, or
-- reject_purchase_line_mutation. History is never rewritten. Nothing is
-- relaxed.

create or replace function private.enforce_purchase_line_recorded_by_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.recorded_by is null then
    raise exception
      'Purchase line recorder is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists purchase_lines_recorded_by_evidence
  on public.purchase_lines;
create trigger purchase_lines_recorded_by_evidence
before insert on public.purchase_lines
for each row execute function private.enforce_purchase_line_recorded_by_evidence();

revoke all on function private.enforce_purchase_line_recorded_by_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_purchase_line_recorded_by_evidence() is
  'Fail closed: purchase_lines INSERT requires a non-null recorded_by. Account-deletion anonymization UPDATEs remain permitted.';

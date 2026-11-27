-- Setup-attachment inserts must carry a created_by actor.
--
-- `public.setup_attachments.created_by` is nullable so account-deletion
-- anonymization can clear only the deleted operator's auth identity while
-- preserving the attachment's operational history (ON DELETE SET NULL). There
-- is intentionally no table CHECK / NOT NULL that forces a creator on every
-- row, because that would block the FK anonymization UPDATE.
--
-- Hosted public.save_restaurant_setup already stamps auth.uid() into
-- created_by on INSERT. Any other INSERT that reaches the table (including
-- direct service_role inserts) can still mint an unattributable setup
-- attachment with created_by null. Client DML is revoked; service_role /
-- direct INSERT paths still reach the table.
--
-- This migration fails closed at the database boundary for every INSERT
-- (RPC writer, future service inserts) when created_by is null.
-- Account-deletion anonymization UPDATEs remain allowed — there is
-- intentionally no NOT NULL CHECK.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite save_restaurant_setup. History is never rewritten.
-- Nothing is relaxed. Orthogonal to setup_attachments locale / ASCII-C /
-- kind-status pins and autonomy-rule created_by tip (#1303).

create or replace function private.enforce_setup_attachment_created_by_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.created_by is null then
    raise exception
      'Setup attachment creator is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists setup_attachments_created_by_evidence
  on public.setup_attachments;
create trigger setup_attachments_created_by_evidence
before insert on public.setup_attachments
for each row execute function private.enforce_setup_attachment_created_by_evidence();

revoke all on function private.enforce_setup_attachment_created_by_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_setup_attachment_created_by_evidence() is
  'Fail closed: setup_attachments INSERT requires a non-null created_by. Account-deletion anonymization UPDATEs remain permitted.';

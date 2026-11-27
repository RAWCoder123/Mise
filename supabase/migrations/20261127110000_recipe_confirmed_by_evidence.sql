-- Menu-item inserts that claim a confirmed recipe revision must carry
-- recipe_confirmed_by.
--
-- `public.menu_items.recipe_confirmed_by` is nullable so account-deletion
-- anonymization can clear only the deleted operator's auth identity while
-- preserving the menu item's confirmation history (ON DELETE SET NULL). Soft
-- CHECK menu_items_recipe_authority_check already requires
-- recipe_confirmed_revision and recipe_confirmed_at together, but still
-- allows those fields to be set with recipe_confirmed_by null.
--
-- Hosted public.confirm_recipe_complete stamps auth.uid() into
-- recipe_confirmed_by via UPDATE, but any INSERT that reaches the table can
-- still mint a confirmed recipe claim with recipe_confirmed_by null.
--
-- Writers normally INSERT unconfirmed menu items and only later UPDATE into a
-- confirmed revision, so those pre-confirmation inserts legitimately leave
-- recipe_confirmed_by null.
--
-- This migration fails closed at the database boundary for every INSERT
-- (RPC writer, future service inserts) when confirmation evidence is present
-- and recipe_confirmed_by is null. Account-deletion anonymization UPDATEs
-- remain allowed — there is intentionally no NOT NULL / confirmation-implies-
-- actor CHECK, because a CHECK would block the ON DELETE SET NULL escape.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite confirm_recipe_complete. History is never rewritten.
-- Nothing is relaxed.

create or replace function private.enforce_recipe_confirmed_by_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.recipe_confirmed_revision is not null
    and new.recipe_confirmed_by is null
  then
    raise exception
      'Recipe confirmation actor is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists recipe_confirmed_by_evidence
  on public.menu_items;
create trigger recipe_confirmed_by_evidence
before insert on public.menu_items
for each row execute function private.enforce_recipe_confirmed_by_evidence();

revoke all on function private.enforce_recipe_confirmed_by_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_recipe_confirmed_by_evidence() is
  'Fail closed: menu_items INSERT requires a non-null recipe_confirmed_by when recipe_confirmed_revision is set. Unconfirmed inserts and confirmation UPDATEs remain permitted.';

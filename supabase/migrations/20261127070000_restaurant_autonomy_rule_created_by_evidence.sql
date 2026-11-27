-- Restaurant autonomy-rule inserts must carry a created_by actor.
--
-- `public.restaurant_autonomy_rules.created_by` is nullable so account-deletion
-- anonymization can clear only the deleted operator's auth identity while
-- preserving the rule's operational history (ON DELETE SET NULL). There is
-- intentionally no table CHECK / NOT NULL that forces a creator on every
-- row, because that would block the FK anonymization UPDATE.
--
-- Hosted public.upsert_restaurant_autonomy_rule already stamps auth.uid() into
-- created_by on INSERT. Any other INSERT that reaches the table (including
-- direct service_role inserts) can still mint an unattributable autonomy
-- rule with created_by null.
--
-- This migration fails closed at the database boundary for every INSERT
-- (RPC writer, future service inserts) when created_by is null.
-- Account-deletion anonymization UPDATEs remain allowed — there is
-- intentionally no NOT NULL CHECK.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite upsert_restaurant_autonomy_rule. History is never rewritten.
-- Nothing is relaxed. Orthogonal to autonomy locale / ASCII-C pins.

create or replace function private.enforce_restaurant_autonomy_rule_created_by_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.created_by is null then
    raise exception
      'Restaurant autonomy rule creator is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists restaurant_autonomy_rule_created_by_evidence
  on public.restaurant_autonomy_rules;
create trigger restaurant_autonomy_rule_created_by_evidence
before insert on public.restaurant_autonomy_rules
for each row execute function private.enforce_restaurant_autonomy_rule_created_by_evidence();

revoke all on function private.enforce_restaurant_autonomy_rule_created_by_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_restaurant_autonomy_rule_created_by_evidence() is
  'Fail closed: restaurant_autonomy_rules INSERT requires a non-null created_by. Account-deletion anonymization UPDATEs remain permitted.';

-- Restaurant autonomy-rule inserts must carry an updated_by actor.
--
-- `public.restaurant_autonomy_rules.updated_by` is nullable so account-deletion
-- anonymization can clear only the deleted operator's auth identity while
-- preserving the rule's operational history (ON DELETE SET NULL). There is
-- intentionally no table CHECK / NOT NULL that forces an updater on every
-- row, because that would block the FK anonymization UPDATE.
--
-- Hosted public.upsert_restaurant_autonomy_rule already stamps auth.uid() into
-- updated_by on INSERT (and on the conflict UPDATE path). Any other INSERT
-- that reaches the table (including direct service_role inserts) can still
-- mint an unattributable autonomy rule with updated_by null.
--
-- This migration fails closed at the database boundary for every INSERT
-- (RPC writer, future service inserts) when updated_by is null.
-- Account-deletion anonymization UPDATEs remain allowed — there is
-- intentionally no NOT NULL CHECK.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite upsert_restaurant_autonomy_rule. History is never rewritten.
-- Nothing is relaxed. Orthogonal to autonomy-rule created_by tip (#1303) and
-- autonomy locale / ASCII-C pins.
-- Contested merge: #1303 null-created_by probe should stamp updated_by once
-- this lands (otherwise both BEFORE INSERT tips may race on null/null).

create or replace function private.enforce_restaurant_autonomy_rule_updated_by_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.updated_by is null then
    raise exception
      'Restaurant autonomy rule updater is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists restaurant_autonomy_rule_updated_by_evidence
  on public.restaurant_autonomy_rules;
create trigger restaurant_autonomy_rule_updated_by_evidence
before insert on public.restaurant_autonomy_rules
for each row execute function private.enforce_restaurant_autonomy_rule_updated_by_evidence();

revoke all on function private.enforce_restaurant_autonomy_rule_updated_by_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_restaurant_autonomy_rule_updated_by_evidence() is
  'Fail closed: restaurant_autonomy_rules INSERT requires a non-null updated_by. Account-deletion anonymization UPDATEs remain permitted.';

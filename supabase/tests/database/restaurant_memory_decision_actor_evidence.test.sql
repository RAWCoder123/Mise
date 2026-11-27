create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' restaurant_memory_decision_actor_evidence.test.sql
-- No loops or conditional assertion paths. If pgTAP reports a different count,
-- that is a failure to investigate, not a number to edit.
select plan(11);

create or replace function pg_temp.error_of(statement text)
returns text language plpgsql as $$
begin execute statement; return null;
exception when others then return sqlerrm;
end;
$$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('a1111111-1111-4111-8111-11111111111a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'restaurant-memory-decision-actor-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('a0000000-0000-4000-8000-00000000000a', 'Restaurant Memory Decision Actor Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('a0000000-0000-4000-8000-00000000000a', 'a1111111-1111-4111-8111-11111111111a', 'manager', 'active');

select has_function(
  'private',
  'enforce_restaurant_memory_decision_actor_evidence',
  'restaurant memory decision actor evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.restaurant_memories (
      restaurant_id, memory_type, statement, evidence, confidence,
      first_observed_at, last_updated_at, scope, source, status, dedupe_key
    ) values (
      'a0000000-0000-4000-8000-00000000000a',
      'waste_pattern', 'null corrector probe', '[]'::jsonb, 0.5,
      now(), now(), 'restaurant', 'operator_decision', 'corrected',
      'memory-decision-actor-null-corrected'
    )
  $sql$),
  'Restaurant memory decision actor is required',
  'direct restaurant_memories insert cannot mint corrected status without corrected_by'
);

select is(
  pg_temp.error_of($sql$
    insert into public.restaurant_memories (
      restaurant_id, memory_type, statement, evidence, confidence,
      first_observed_at, last_updated_at, scope, source, status, dedupe_key
    ) values (
      'a0000000-0000-4000-8000-00000000000a',
      'waste_pattern', 'null dismisser probe', '[]'::jsonb, 0.5,
      now(), now(), 'restaurant', 'operator_decision', 'dismissed',
      'memory-decision-actor-null-dismissed'
    )
  $sql$),
  'Restaurant memory decision actor is required',
  'direct restaurant_memories insert cannot mint dismissed status without corrected_by'
);

select is(
  pg_temp.error_of($sql$
    insert into public.restaurant_memories (
      id, restaurant_id, memory_type, statement, evidence, confidence,
      first_observed_at, last_updated_at, scope, source, status,
      corrected_by, corrected_at, dedupe_key
    ) values (
      'a0000000-0000-4000-8000-0000000000ab',
      'a0000000-0000-4000-8000-00000000000a',
      'waste_pattern', 'attributed corrected probe', '[]'::jsonb, 0.5,
      now(), now(), 'restaurant', 'operator_decision', 'corrected',
      'a1111111-1111-4111-8111-11111111111a', now(),
      'memory-decision-actor-attributed-corrected'
    )
  $sql$),
  null,
  'direct restaurant_memories insert with corrected_by remains allowed for corrected status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.restaurant_memories (
      id, restaurant_id, memory_type, statement, evidence, confidence,
      first_observed_at, last_updated_at, scope, source, status,
      corrected_by, corrected_at, dedupe_key
    ) values (
      'a0000000-0000-4000-8000-0000000000aa',
      'a0000000-0000-4000-8000-00000000000a',
      'waste_pattern', 'attributed dismissed probe', '[]'::jsonb, 0.5,
      now(), now(), 'restaurant', 'operator_decision', 'dismissed',
      'a1111111-1111-4111-8111-11111111111a', now(),
      'memory-decision-actor-attributed-dismissed'
    )
  $sql$),
  null,
  'direct restaurant_memories insert with corrected_by remains allowed for dismissed status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.restaurant_memories (
      id, restaurant_id, memory_type, statement, evidence, confidence,
      first_observed_at, last_updated_at, scope, source, status, dedupe_key
    ) values (
      'a0000000-0000-4000-8000-0000000000ac',
      'a0000000-0000-4000-8000-00000000000a',
      'waste_pattern', 'pre-decision active fixture', '[]'::jsonb, 0.5,
      now(), now(), 'restaurant', 'supplier_delivery_outcomes', 'active',
      'memory-decision-actor-active'
    )
  $sql$),
  null,
  'direct restaurant_memories insert can open active status without corrected_by'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-11111111111a', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.update_restaurant_memory(
      'a0000000-0000-4000-8000-00000000000a',
      'a0000000-0000-4000-8000-0000000000ac',
      'corrected',
      'Keep Thursday prep lower than the learned pattern.'
    )
  $sql$),
  null,
  'hosted update_restaurant_memory can correct an active memory'
);

reset role;

select is(
  (
    select corrected_by
    from public.restaurant_memories
    where id = 'a0000000-0000-4000-8000-0000000000ac'
  ),
  'a1111111-1111-4111-8111-11111111111a'::uuid,
  'accepted update_restaurant_memory keeps the authenticated corrected_by'
);

select is(
  pg_temp.error_of($sql$
    delete from auth.users
    where id = 'a1111111-1111-4111-8111-11111111111a'
  $sql$),
  null,
  'account deletion remains allowed after restaurant_memories history exists'
);

select is(
  (
    select count(*)
    from public.restaurant_memories
    where restaurant_id = 'a0000000-0000-4000-8000-00000000000a'
      and id = 'a0000000-0000-4000-8000-0000000000aa'
      and corrected_by is null
      and status = 'dismissed'
  ),
  1::bigint,
  'account deletion anonymizes decision actors without rewriting business fields'
);

select is(
  (
    select count(*)
    from public.restaurant_memories
    where restaurant_id = 'a0000000-0000-4000-8000-00000000000a'
      and id = 'a0000000-0000-4000-8000-0000000000aa'
      and status = 'dismissed'
      and statement = 'attributed dismissed probe'
  ),
  1::bigint,
  'account deletion preserves immutable restaurant_memories business fields'
);

select * from finish();
rollback;

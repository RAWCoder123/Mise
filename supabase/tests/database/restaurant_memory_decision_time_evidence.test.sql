create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' restaurant_memory_decision_time_evidence.test.sql
-- No loops or conditional assertion paths. If pgTAP reports a different count,
-- that is a failure to investigate, not a number to edit.
select plan(10);

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
  ('b1111111-1111-4111-8111-11111111111b', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'restaurant-memory-decision-time-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('b0000000-0000-4000-8000-00000000000b', 'Restaurant Memory Decision Time Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('b0000000-0000-4000-8000-00000000000b', 'b1111111-1111-4111-8111-11111111111b', 'manager', 'active');

select has_function(
  'private',
  'enforce_restaurant_memory_decision_time_evidence',
  'restaurant memory decision time evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.restaurant_memories (
      restaurant_id, memory_type, statement, evidence, confidence,
      first_observed_at, last_updated_at, scope, source, status, dedupe_key
    ) values (
      'b0000000-0000-4000-8000-00000000000b',
      'waste_pattern', 'null corrected_at probe', '[]'::jsonb, 0.5,
      now(), now(), 'restaurant', 'operator_decision', 'corrected',
      'memory-decision-time-null-corrected'
    )
  $sql$),
  'Restaurant memory decision time is required',
  'direct restaurant_memories insert cannot mint corrected status without corrected_at'
);

select is(
  pg_temp.error_of($sql$
    insert into public.restaurant_memories (
      restaurant_id, memory_type, statement, evidence, confidence,
      first_observed_at, last_updated_at, scope, source, status, dedupe_key
    ) values (
      'b0000000-0000-4000-8000-00000000000b',
      'waste_pattern', 'null dismissed_at probe', '[]'::jsonb, 0.5,
      now(), now(), 'restaurant', 'operator_decision', 'dismissed',
      'memory-decision-time-null-dismissed'
    )
  $sql$),
  'Restaurant memory decision time is required',
  'direct restaurant_memories insert cannot mint dismissed status without corrected_at'
);

select is(
  pg_temp.error_of($sql$
    insert into public.restaurant_memories (
      id, restaurant_id, memory_type, statement, evidence, confidence,
      first_observed_at, last_updated_at, scope, source, status,
      corrected_by, corrected_at, dedupe_key
    ) values (
      'b0000000-0000-4000-8000-0000000000bb',
      'b0000000-0000-4000-8000-00000000000b',
      'waste_pattern', 'stamped corrected probe', '[]'::jsonb, 0.5,
      now(), now(), 'restaurant', 'operator_decision', 'corrected',
      'b1111111-1111-4111-8111-11111111111b', '2026-11-27T12:00:00Z'::timestamptz,
      'memory-decision-time-stamped-corrected'
    )
  $sql$),
  null,
  'direct restaurant_memories insert with corrected_at remains allowed for corrected status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.restaurant_memories (
      id, restaurant_id, memory_type, statement, evidence, confidence,
      first_observed_at, last_updated_at, scope, source, status,
      corrected_by, corrected_at, dedupe_key
    ) values (
      'b0000000-0000-4000-8000-0000000000ba',
      'b0000000-0000-4000-8000-00000000000b',
      'waste_pattern', 'stamped dismissed probe', '[]'::jsonb, 0.5,
      now(), now(), 'restaurant', 'operator_decision', 'dismissed',
      'b1111111-1111-4111-8111-11111111111b', '2026-11-27T12:00:00Z'::timestamptz,
      'memory-decision-time-stamped-dismissed'
    )
  $sql$),
  null,
  'direct restaurant_memories insert with corrected_at remains allowed for dismissed status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.restaurant_memories (
      id, restaurant_id, memory_type, statement, evidence, confidence,
      first_observed_at, last_updated_at, scope, source, status, dedupe_key
    ) values (
      'b0000000-0000-4000-8000-0000000000bc',
      'b0000000-0000-4000-8000-00000000000b',
      'waste_pattern', 'pre-decision active fixture', '[]'::jsonb, 0.5,
      now(), now(), 'restaurant', 'supplier_delivery_outcomes', 'active',
      'memory-decision-time-active'
    )
  $sql$),
  null,
  'direct restaurant_memories insert can open active status without corrected_at'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1111111-1111-4111-8111-11111111111b', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.update_restaurant_memory(
      'b0000000-0000-4000-8000-00000000000b',
      'b0000000-0000-4000-8000-0000000000bc',
      'corrected',
      'Keep Thursday prep lower than the learned pattern.'
    )
  $sql$),
  null,
  'hosted update_restaurant_memory can correct an active memory (INSERT-only tip)'
);

reset role;

select is(
  (
    select (corrected_at is not null)
    from public.restaurant_memories
    where id = 'b0000000-0000-4000-8000-0000000000bc'
  ),
  true,
  'accepted update_restaurant_memory stamps corrected_at'
);

select is(
  pg_temp.error_of($sql$
    delete from auth.users
    where id = 'b1111111-1111-4111-8111-11111111111b'
  $sql$),
  null,
  'account deletion remains allowed after restaurant_memories history exists'
);

select is(
  (
    select count(*)
    from public.restaurant_memories
    where restaurant_id = 'b0000000-0000-4000-8000-00000000000b'
      and id = 'b0000000-0000-4000-8000-0000000000ba'
      and corrected_by is null
      and corrected_at is not null
      and status = 'dismissed'
  ),
  1::bigint,
  'account deletion anonymizes decision actors while preserving corrected_at'
);

select * from finish();
rollback;

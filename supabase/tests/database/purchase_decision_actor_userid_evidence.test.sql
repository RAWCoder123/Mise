create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' purchase_decision_actor_userid_evidence.test.sql
-- No loops or conditional assertion paths. If pgTAP reports a different count,
-- that is a failure to investigate, not a number to edit.
select plan(8);

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
  ('d1111111-1111-4111-8111-11111111111d', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'decision-actor-userid-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('d0000000-0000-4000-8000-00000000000d', 'Decision Actor UserId Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('d0000000-0000-4000-8000-00000000000d', 'd1111111-1111-4111-8111-11111111111d', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('d0000000-0000-4000-8000-000000000091', 'd0000000-0000-4000-8000-00000000000d', 'Evidence Produce', 'evidence produce');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit,
  canonical_unit_verification_status, canonical_unit_verified_at, canonical_unit_verified_by
) values
  (
    'd0000000-0000-4000-8000-000000000092', 'd0000000-0000-4000-8000-00000000000d',
    'Tomatoes', 'Produce', 'each', 1, 10, 3, 20,
    'd0000000-0000-4000-8000-000000000091', 'Evidence Produce',
    'each', 1, 'verified', now(), 'd1111111-1111-4111-8111-11111111111d'
  );

insert into public.inventory_events (
  id, restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
  effective_at, actor_user_id, source, client_event_id, idempotency_key
) values
  (
    'd0000000-0000-4000-8000-000000000093', 'd0000000-0000-4000-8000-00000000000d',
    'd0000000-0000-4000-8000-000000000092', 'count', 1, 'each', now(),
    'd1111111-1111-4111-8111-11111111111d', 'decision-actor-userid-test',
    'decision-actor-count-1', 'decision-actor-count-1'
  );

update public.system_operational_controls
set ordering_policy = 'draft_only', order_drafting_enabled = true where singleton;
update public.restaurant_operational_controls
set ordering_policy = 'draft_only', order_drafting_enabled = true
where restaurant_id = 'd0000000-0000-4000-8000-00000000000d';
update private.restaurant_signal_state
set signals_revision = planning_revision, status = 'current'
where restaurant_id = 'd0000000-0000-4000-8000-00000000000d';

insert into public.purchase_recommendations (
  id, restaurant_id, inventory_item_id, item_name, supplier_id, supplier_name,
  recommended_quantity, unit, reason, urgency, status, generation_source, planning_revision
) values
  (
    'd0000000-0000-4000-8000-000000000094', 'd0000000-0000-4000-8000-00000000000d',
    'd0000000-0000-4000-8000-000000000092', 'Tomatoes',
    'd0000000-0000-4000-8000-000000000091', 'Evidence Produce', 10, 'each',
    'Mise rules evidence', 'medium', 'pending', 'mise_rules',
    (select signals_revision from private.restaurant_signal_state
      where restaurant_id = 'd0000000-0000-4000-8000-00000000000d')
  );

select has_function(
  'private',
  'enforce_purchase_decision_actor_userid_evidence',
  'purchase decision actor userid evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_decision_events (
      restaurant_id, actor_user_id, actor_role, decision_type,
      purchase_recommendation_id, inventory_item_id, supplier_id,
      recommendation_source, recommendation_unit,
      recommended_quantity, chosen_quantity, canonical_unit,
      canonical_quantity_per_unit, recommended_canonical_quantity,
      chosen_canonical_quantity, quantity_delta, quantity_ratio,
      source_event_key, occurred_at
    ) values (
      'd0000000-0000-4000-8000-00000000000d',
      null,
      'manager', 'approve',
      'd0000000-0000-4000-8000-000000000094',
      'd0000000-0000-4000-8000-000000000092',
      'd0000000-0000-4000-8000-000000000091',
      'mise_rules', 'each',
      10, 10, 'each',
      1, 10, 10, 0, 1,
      'direct:decision-actor-null-1',
      now()
    )
  $sql$),
  'Purchase decision actor is required',
  'direct purchase_decision_events insert cannot mint an unattributable null actor'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_decision_events (
      restaurant_id, actor_user_id, actor_role, decision_type,
      purchase_recommendation_id, inventory_item_id, supplier_id,
      recommendation_source, recommendation_unit,
      recommended_quantity, chosen_quantity, canonical_unit,
      canonical_quantity_per_unit, recommended_canonical_quantity,
      chosen_canonical_quantity, quantity_delta, quantity_ratio,
      source_event_key, occurred_at
    ) values (
      'd0000000-0000-4000-8000-00000000000d',
      'd1111111-1111-4111-8111-11111111111d',
      'manager', 'approve',
      'd0000000-0000-4000-8000-000000000094',
      'd0000000-0000-4000-8000-000000000092',
      'd0000000-0000-4000-8000-000000000091',
      'mise_rules', 'each',
      10, 10, 'each',
      1, 10, 10, 0, 1,
      'direct:decision-actor-ok-1',
      now()
    )
  $sql$),
  null,
  'direct purchase_decision_events insert with a real actor remains allowed'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1111111-1111-4111-8111-11111111111d', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.dismiss_purchase_recommendation(
      'd0000000-0000-4000-8000-00000000000d',
      'd0000000-0000-4000-8000-000000000094'
    )
  $sql$),
  null,
  'manager JWT can dismiss a recommendation with auth.uid() actor attribution'
);

select is(
  (select actor_user_id from public.purchase_decision_events
    where restaurant_id = 'd0000000-0000-4000-8000-00000000000d'
      and purchase_recommendation_id = 'd0000000-0000-4000-8000-000000000094'
      and decision_type = 'dismiss'),
  'd1111111-1111-4111-8111-11111111111d'::uuid,
  'accepted RPC decision keeps the authenticated actor_user_id'
);

reset role;

select is(
  pg_temp.error_of($sql$
    delete from auth.users
    where id = 'd1111111-1111-4111-8111-11111111111d'
  $sql$),
  null,
  'account deletion remains allowed after purchase-decision history exists'
);

select is(
  (
    select count(*)
    from public.purchase_decision_events
    where purchase_recommendation_id = 'd0000000-0000-4000-8000-000000000094'
      and decision_type = 'dismiss'
      and actor_user_id is null
  ),
  1::bigint,
  'account deletion anonymizes actor_user_id without rewriting business fields'
);

select is(
  (
    select count(*)
    from public.purchase_decision_events
    where purchase_recommendation_id = 'd0000000-0000-4000-8000-000000000094'
      and decision_type = 'dismiss'
      and recommended_quantity = 10
      and recommendation_source = 'mise_rules'
      and chosen_quantity is null
  ),
  1::bigint,
  'account deletion preserves immutable purchase-decision business fields'
);

select * from finish();
rollback;

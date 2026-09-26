-- MISE-005T: pin complete-send provider_message_id cntrl preflight to COLLATE "C".
--
-- private.service_complete_supplier_email_send still rejects control characters with:
--   p_provider_message_id ~ '[[:cntrl:]]'
-- Bare POSIX [[:cntrl:]] follows database LC_CTYPE. This cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; MISE-005J/005S
-- pinned claim/rfc Message-Id gates to collate "C", but left complete-send's
-- provider_message_id preflight on bare [[:cntrl:]].
--
-- Complete refuses with "Invalid provider message id" before any durable write
-- when the provider id fails the length/cntrl gate. If LC_CTYPE drifted,
-- complete could accept a provider id that a restored C-locale gate would
-- reject (or refuse one it would accept) — breaking claim→complete continuity
-- after restore for the same Gmail provider message id bytes.
--
-- Scope:
--   - Rewrite private.service_complete_supplier_email_send so the
--     provider_message_id preflight uses
--     (p_provider_message_id collate "C") ~ '[[:cntrl:]]'
--   - Preserve service_role EXECUTE; public/anon/authenticated revoked
-- Does NOT rewrite claim (MISE-005S), reattach envelope/rfc CHECKs
-- (MISE-005J/005O/005P), or rewrite build_supplier_send_content (MISE-005Q).
-- Must apply after MISE-003C. Prefer after MISE-005S so claim+complete pins
-- land together; timestamp after 005S. Compose-safe alone on main.

create or replace function private.service_complete_supplier_email_send(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_order_id uuid,
  p_claim_token uuid,
  p_provider_message_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_snapshot public.supplier_orders%rowtype;
  order_row public.supplier_orders%rowtype;
  action_row public.mise_actions%rowtype;
  delivery private.supplier_email_deliveries%rowtype;
  current_ids uuid[];
  normalized_claimed_ids uuid[];
  ordered_rows jsonb;
  changed_count integer;
  is_v2 boolean;
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Supplier email access denied' using errcode = '42501';
  end if;
  if p_provider_message_id is null
    or pg_catalog.length(p_provider_message_id) not between 1 and 512
    or p_provider_message_id collate "C" ~ '[[:cntrl:]]'
  then
    raise exception 'Invalid provider message id' using errcode = '22023';
  end if;

  select * into order_snapshot from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id;
  if not found then raise exception 'Supplier order not found' using errcode = 'P0002'; end if;
  perform private.lock_supplier_authority(p_restaurant_id, order_snapshot.supplier_id);
  select * into action_row from public.mise_actions action
  where action.restaurant_id = p_restaurant_id
    and action.idempotency_key = pg_catalog.format('send_supplier_order:%s', p_order_id)
  for update;
  select * into order_row from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id
  for update;
  if order_row.supplier_id is distinct from order_snapshot.supplier_id then
    raise exception 'Supplier order identity changed concurrently; retry' using errcode = '40001';
  end if;
  select * into delivery from private.supplier_email_deliveries candidate
  where candidate.restaurant_id = p_restaurant_id
    and candidate.supplier_order_id = p_order_id
  for update;
  if not found then
    raise exception 'Supplier email claim is unavailable' using errcode = '22023';
  end if;

  if delivery.status = 'sent' and delivery.provider_message_id = p_provider_message_id then
    select coalesce(pg_catalog.jsonb_agg(
      pg_catalog.to_jsonb(recommendation) order by recommendation.id
    ), '[]'::jsonb)
    into ordered_rows from public.purchase_recommendations recommendation
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.id = any(coalesce(
        delivery.claimed_recommendation_ids, '{}'::uuid[]
      ))
      and recommendation.status = 'ordered';
    return pg_catalog.jsonb_build_object(
      'outcome', 'already_applied',
      'supplierId', coalesce(delivery.supplier_id, order_row.supplier_id),
      'externalIdentityChangedDuringClaim', delivery.external_identity_changed_during_claim,
      'order', pg_catalog.to_jsonb(order_row),
      'ordered_recommendations', ordered_rows
    );
  end if;
  if delivery.status <> 'sending'
    or delivery.claim_token <> p_claim_token
    or delivery.actor_user_id <> p_actor_user_id
  then
    raise exception 'Supplier email claim is unavailable' using errcode = '22023';
  end if;

  is_v2 := delivery.content_version = 'mise.supplier_send.v2';
  if delivery.content_version not in ('mise.supplier_send.v1', 'mise.supplier_send.v2')
    or (is_v2 and delivery.supplier_id is distinct from order_row.supplier_id)
    or (not is_v2 and delivery.supplier_id is not null)
    or delivery.content_fingerprint !~ '^[a-f0-9]{64}$'
    or delivery.authority_version <> 'mise.purchase_authority.v1'
    or delivery.authority_fingerprint !~ '^[a-f0-9]{64}$'
    or delivery.approved_action_id is null
    or delivery.claimed_recommendation_ids is null
    or pg_catalog.cardinality(delivery.claimed_recommendation_ids) not between 1 and 250
    or delivery.claimed_from is null or delivery.claimed_to is null
    or delivery.claimed_subject is null or delivery.credential_generation is null
    or delivery.claimed_content_revision is null
    or delivery.authority_evaluated_at is null
  then
    raise exception 'Supplier email claim proof is incomplete' using errcode = '22023';
  end if;

  if action_row.id is distinct from delivery.approved_action_id
    or action_row.status <> 'approved'
    or action_row.expected_impact->'approvedSendContent'->>'version'
      is distinct from delivery.content_version
    or action_row.expected_impact->'approvedSendContent'->>'fingerprint'
      is distinct from delivery.content_fingerprint
    or action_row.expected_impact->'approvedSendContent'->'contentRevision'
      is distinct from pg_catalog.to_jsonb(delivery.claimed_content_revision)
    or action_row.expected_impact->'approvedSendContent'->>'from'
      is distinct from delivery.claimed_from
    or action_row.expected_impact->'approvedSendContent'->>'to'
      is distinct from delivery.claimed_to
    or action_row.expected_impact->'approvedSendContent'->>'subject'
      is distinct from delivery.claimed_subject
    or (
      is_v2 and (
        action_row.expected_impact->>'supplierId' is distinct from delivery.supplier_id::text
        or action_row.expected_impact->'approvedSendContent'->>'supplierId'
          is distinct from delivery.supplier_id::text
      )
    )
    or order_row.status <> 'draft'
    or order_row.send_content_revision <> delivery.claimed_content_revision
  then
    raise exception 'Supplier email claim no longer matches the durable order'
      using errcode = '22023';
  end if;

  perform 1 from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.supplier_order_id = p_order_id
    and recommendation.status = 'approved'
  order by recommendation.id for update;
  select pg_catalog.array_agg(recommendation.id order by recommendation.id)
  into current_ids from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.supplier_order_id = p_order_id
    and recommendation.status = 'approved'
    and recommendation.supplier_id = order_row.supplier_id;
  select pg_catalog.array_agg(distinct claimed_id order by claimed_id)
  into normalized_claimed_ids
  from unnest(delivery.claimed_recommendation_ids) claimed_id;
  if normalized_claimed_ids is distinct from delivery.claimed_recommendation_ids
    or current_ids is distinct from delivery.claimed_recommendation_ids
  then
    raise exception 'Supplier email claimed line set cannot be proven' using errcode = '22023';
  end if;

  update private.supplier_email_deliveries candidate
  set status = 'sent', provider_message_id = p_provider_message_id,
    provider_accepted_at = pg_catalog.now(), last_error_code = null,
    updated_at = pg_catalog.now()
  where candidate.id = delivery.id;
  update public.supplier_orders orders
  set status = 'sent', email_provider = 'gmail',
    provider_message_id = p_provider_message_id, sent_at = pg_catalog.now(),
    sent_by_user_id = p_actor_user_id
  where orders.restaurant_id = p_restaurant_id
    and orders.id = p_order_id and orders.status = 'draft'
  returning * into order_row;
  if not found then
    raise exception 'Supplier order is not sendable' using errcode = '22023';
  end if;

  update public.purchase_recommendations recommendation
  set status = 'ordered'
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.id = any(delivery.claimed_recommendation_ids)
    and recommendation.supplier_order_id = p_order_id
    and recommendation.supplier_id = order_row.supplier_id
    and recommendation.status = 'approved';
  get diagnostics changed_count = row_count;
  if changed_count <> pg_catalog.cardinality(delivery.claimed_recommendation_ids) then
    raise exception 'Supplier email claimed line completion was incomplete'
      using errcode = '22023';
  end if;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, p_actor_user_id, 'supplier_order_sent',
    'supplier_orders', p_order_id,
    pg_catalog.jsonb_build_object(
      'provider', 'gmail', 'provider_message_id', p_provider_message_id,
      'supplier_id', coalesce(delivery.supplier_id, order_row.supplier_id),
      'ordered_recommendation_count', changed_count,
      'content_version', delivery.content_version,
      'content_fingerprint', delivery.content_fingerprint,
      'authority_version', delivery.authority_version,
      'authority_fingerprint', delivery.authority_fingerprint
    )
  );
  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.to_jsonb(recommendation) order by recommendation.id
  ), '[]'::jsonb)
  into ordered_rows from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.id = any(delivery.claimed_recommendation_ids)
    and recommendation.status = 'ordered';
  return pg_catalog.jsonb_build_object(
    'outcome', 'applied',
    'supplierId', coalesce(delivery.supplier_id, order_row.supplier_id),
    'externalIdentityChangedDuringClaim', delivery.external_identity_changed_during_claim,
    'order', pg_catalog.to_jsonb(order_row),
    'ordered_recommendations', ordered_rows
  );
end;
$$;

revoke all on function private.service_complete_supplier_email_send(
  uuid, uuid, uuid, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function private.service_complete_supplier_email_send(
  uuid, uuid, uuid, uuid, text
) to service_role;

comment on function private.service_complete_supplier_email_send(uuid, uuid, uuid, uuid, text) is
  'MISE-005T: complete supplier email send; provider_message_id cntrl preflight uses COLLATE C.';

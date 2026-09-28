-- MISE-005BP: pin Square sync writer p_sync_cursor cntrl preflight to COLLATE "C".
--
-- private.service_apply_square_sync_result_scoped still forwards p_sync_cursor to
-- private.service_apply_square_sync_result_mise_003a_base, which stores:
--   nullif(left(coalesce(p_sync_cursor, ''), 500), '')
-- with no control-character rejection before the durable UPDATE. MISE-005BM
-- (#473) adds the matching nullable length+cntrl CHECK on
-- public.pos_integrations.sync_cursor under COLLATE "C"; this tip adds the
-- clear 22023 writer preflight so a control-bearing cursor fails closed before
-- prepare / base apply work, rather than only at CHECK time.
--
-- This cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster. POSIX character classes follow database LC_CTYPE. Without a
-- COLLATE "C" writer gate, LC_CTYPE drift could accept (or refuse) cursor bytes
-- disagreeing with the restored C-locale CHECK — breaking POS incremental-sync
-- continuity across dump/restore for the same Square cursor token.
--
-- Scope:
--   - Rewrite private.service_apply_square_sync_result_scoped so the stored
--     cursor shape is validated as:
--       nullif(left(coalesce(p_sync_cursor, ''), 500), '') is null
--       or that value collate "C" !~ '[[:cntrl:]]'
--     raising 'Square sync cursor is invalid' (22023) on failure.
--   - Preserve service_role EXECUTE; public/anon/authenticated revoked.
-- Does NOT reattach pos_integrations_sync_cursor_check (MISE-005BM), rewrite
-- service_apply_square_sync_result_mise_003a_base / prepare_square_sales /
-- begin/fail authority sync, or touch contested Square OAuth / location stacks
-- (#236/#460/#465). Timestamp after MISE-005BO (#475). Compose-safe alone on
-- main; prefer after MISE-005BM so CHECK + writer pins land together.

create or replace function private.service_apply_square_sync_result_scoped(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_integration_id uuid,
  p_sync_token uuid,
  p_snapshot_mode text,
  p_sales jsonb,
  p_catalog_items jsonb,
  p_sync_cursor text,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  integration public.pos_integrations%rowtype;
  prepared_sales jsonb;
  applied jsonb;
  import_id uuid;
  completed_at timestamptz;
  active_location_ids text[];
  normalized_sync_cursor text;
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Square sync access denied' using errcode = '42501';
  end if;
  if p_sync_token is null or p_snapshot_mode not in ('full', 'partial')
    or p_from is null or p_to is null or p_to < p_from
  then
    raise exception 'Square sync completion boundary is invalid' using errcode = '22023';
  end if;

  -- Match base writer storage: left(..., 500) then nullif empty → NULL.
  -- Reject control bytes under COLLATE "C" before prepare / durable apply.
  normalized_sync_cursor := nullif(left(coalesce(p_sync_cursor, ''), 500), '');
  if normalized_sync_cursor is not null
    and normalized_sync_cursor collate "C" ~ '[[:cntrl:]]'
  then
    raise exception 'Square sync cursor is invalid' using errcode = '22023';
  end if;

  select * into integration
  from public.pos_integrations candidate
  where candidate.id = p_integration_id
    and candidate.restaurant_id = p_restaurant_id
    and candidate.provider = 'square'
  for update;
  if not found then
    raise exception 'Square integration not found' using errcode = '22023';
  end if;
  if integration.authority_sync_token is distinct from p_sync_token
    or integration.authority_sync_mode is distinct from p_snapshot_mode
    or integration.authority_sync_window_from is distinct from p_from
    or integration.authority_sync_window_to is distinct from p_to
  then
    raise exception 'Square sync boundary changed before completion' using errcode = '40001';
  end if;

  select coalesce(array_agg(location.external_location_id order by location.external_location_id), '{}')
  into active_location_ids
  from public.pos_locations location
  where location.restaurant_id = p_restaurant_id
    and location.pos_integration_id = p_integration_id
    and location.status = 'active';
  if active_location_ids is distinct from integration.authority_sync_location_ids then
    raise exception 'Square active locations changed during synchronization' using errcode = '40001';
  end if;

  prepared_sales := private.prepare_square_sales_for_authority(
    p_restaurant_id,
    p_integration_id,
    p_sales,
    p_catalog_items,
    p_from,
    p_to,
    p_snapshot_mode = 'full'
  );

  applied := private.service_apply_square_sync_result_mise_003a_base(
    p_actor_user_id,
    p_restaurant_id,
    p_integration_id,
    prepared_sales,
    p_catalog_items,
    normalized_sync_cursor,
    p_from,
    p_to
  );
  import_id := nullif(applied->>'importId', '')::uuid;
  completed_at := nullif(applied->>'authorityWindowCompletedAt', '')::timestamptz;

  -- The base apply always updates the integration and therefore holds the
  -- restaurant planning-revision row through commit. Rechecking here makes a
  -- location change linearize before this completion or after it, never inside
  -- an attested snapshot.
  select coalesce(array_agg(location.external_location_id order by location.external_location_id), '{}')
  into active_location_ids
  from public.pos_locations location
  where location.restaurant_id = p_restaurant_id
    and location.pos_integration_id = p_integration_id
    and location.status = 'active';
  if active_location_ids is distinct from integration.authority_sync_location_ids then
    raise exception 'Square active locations changed during synchronization' using errcode = '40001';
  end if;

  update public.pos_integrations
  set authority_window_from = case when p_snapshot_mode = 'full' then p_from else null end,
    authority_window_to = case when p_snapshot_mode = 'full' then p_to else null end,
    authority_window_completed_at = case
      when p_snapshot_mode = 'full' then completed_at else null end,
    authority_sync_token = null,
    authority_sync_started_at = null,
    authority_sync_mode = null,
    authority_sync_window_from = null,
    authority_sync_window_to = null,
    authority_sync_location_ids = null,
    updated_at = coalesce(completed_at, clock_timestamp())
  where id = p_integration_id
    and restaurant_id = p_restaurant_id
    and authority_sync_token = p_sync_token;
  if not found then
    raise exception 'Square sync boundary changed during completion' using errcode = '40001';
  end if;

  if import_id is not null then
    update public.sales_imports
    set metadata = metadata || jsonb_build_object(
      'snapshot_mode', p_snapshot_mode,
      'authority_window_attested', p_snapshot_mode = 'full'
    )
    where id = import_id and restaurant_id = p_restaurant_id;
    update public.audit_logs
    set metadata = metadata || jsonb_build_object(
      'snapshot_mode', p_snapshot_mode,
      'authority_window_attested', p_snapshot_mode = 'full'
    )
    where restaurant_id = p_restaurant_id
      and entity_id = import_id
      and action = 'square_sync_completed';
  end if;

  return applied || jsonb_build_object(
    'snapshotMode', p_snapshot_mode,
    'authorityWindowAttested', p_snapshot_mode = 'full',
    'authorityWindowFrom', case when p_snapshot_mode = 'full' then to_jsonb(p_from) else 'null'::jsonb end,
    'authorityWindowTo', case when p_snapshot_mode = 'full' then to_jsonb(p_to) else 'null'::jsonb end,
    'authorityWindowCompletedAt', case
      when p_snapshot_mode = 'full' then to_jsonb(completed_at) else 'null'::jsonb end
  );
end;
$$;

revoke all on function private.service_apply_square_sync_result_scoped(
  uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, date, date
) from public, anon, authenticated, service_role;

grant execute on function private.service_apply_square_sync_result_scoped(
  uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, date, date
) to service_role;

comment on function private.service_apply_square_sync_result_scoped(
  uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, date, date
) is
  'MISE-005BP: apply Square authority sync result; sync_cursor cntrl preflight uses COLLATE C.';

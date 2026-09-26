-- MISE-005W: pin save_restaurant_setup supplier discovery display_name /
-- email cntrl + mailbox shape + email lower to COLLATE "C".
--
-- public.save_restaurant_setup still rejects control characters on supplier
-- discovery rows with bare POSIX [[:cntrl:]] / [[:space:]] and folds email
-- with bare lower(btrim(...)). Those classes and lower() follow database
-- LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A proved locale
-- drift on this cluster; MISE-005B/005V pinned suppliers CHECK +
-- create/rename mutators; MISE-005K/005N pinned recipient CHECKs + upsert.
-- Day-0 setup discovery remained on bare ctype-dependent preflights.
--
-- Setup inserts into public.suppliers and public.supplier_recipients. If
-- LC_CTYPE drifted, setup could accept display_name / email bytes a restored
-- C-locale CHECK would reject (or refuse ones the CHECK accepts) — breaking
-- first-restaurant onboarding continuity after restore for the same
-- operator-entered bytes.
--
-- Scope:
--   - Rewrite public.save_restaurant_setup so supplier discovery uses:
--       coalesce(payload.display_name, '') collate "C" ~ '[[:cntrl:]]'
--       lower(btrim(payload.email) collate "C") collate "C"
--       payload.email collate "C" ~ '[[:cntrl:]]'
--       payload.email collate "C" !~ '^[^[:space:]@]+@...'
--   - Preserve revoke + grant EXECUTE to authenticated only
-- Does NOT reattach suppliers / supplier_recipients CHECKs, rewrite
-- create/rename suppliers, or touch ingest_purchase_lines. Must apply after
-- MISE-003C. Prefer after MISE-005V / MISE-005N so CHECK + mutator pins land
-- together; timestamp after 005V. Compose-safe alone on main
-- (save_restaurant_setup unreplaced since 003c).

create or replace function public.save_restaurant_setup(
  p_restaurant_id uuid,
  p_inventory_items jsonb default '[]'::jsonb,
  p_suppliers jsonb default '[]'::jsonb,
  p_recipe_mappings jsonb default '[]'::jsonb,
  p_pos_sales jsonb default '[]'::jsonb,
  p_attachments jsonb default '[]'::jsonb,
  p_skipped_recipe_ingredients integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_inventory jsonb := coalesce(p_inventory_items, '[]'::jsonb);
  safe_suppliers jsonb := coalesce(p_suppliers, '[]'::jsonb);
  safe_mappings jsonb := coalesce(p_recipe_mappings, '[]'::jsonb);
  safe_sales jsonb := coalesce(p_pos_sales, '[]'::jsonb);
  safe_attachments jsonb := coalesce(p_attachments, '[]'::jsonb);
  supplier_ids jsonb := '{}'::jsonb;
  payload record;
  existing_id uuid;
  inventory_id uuid;
  resolved_supplier_id uuid;
  previous_supplier_id uuid;
  canonical_supplier_name text;
  setup_fingerprint text;
  completed_setup_metadata jsonb;
  supplier_count integer := 0;
  inventory_count integer := 0;
  mapping_count integer := 0;
  sale_count integer := 0;
  attachment_count integer := 0;
  lock_supplier_id uuid;
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  if p_skipped_recipe_ingredients is null
    or p_skipped_recipe_ingredients not between 0 and 1000
  then
    raise exception 'Invalid skipped recipe count' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(safe_inventory) <> 'array'
    or pg_catalog.jsonb_typeof(safe_suppliers) <> 'array'
    or pg_catalog.jsonb_typeof(safe_mappings) <> 'array'
    or pg_catalog.jsonb_typeof(safe_sales) <> 'array'
    or pg_catalog.jsonb_typeof(safe_attachments) <> 'array'
  then
    raise exception 'Setup payloads must be JSON arrays' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(safe_inventory) > 250
    or pg_catalog.jsonb_array_length(safe_suppliers) > 100
    or pg_catalog.jsonb_array_length(safe_mappings) > 1000
    or pg_catalog.jsonb_array_length(safe_sales) > 1000
    or pg_catalog.jsonb_array_length(safe_attachments) > 25
  then
    raise exception 'Setup payload exceeds supported limits' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_restaurant_id::text || E'\x1fsetup', 0
  ));

  if (
    select count(*) from pg_catalog.jsonb_to_recordset(safe_suppliers)
      as value(client_reference_id text, display_name text, email text)
  ) <> (
    select count(distinct value.client_reference_id)
    from pg_catalog.jsonb_to_recordset(safe_suppliers)
      as value(client_reference_id text, display_name text, email text)
  ) or (
    select count(*) from pg_catalog.jsonb_to_recordset(safe_suppliers)
      as value(client_reference_id text, display_name text, email text)
  ) <> (
    select count(distinct private.normalize_supplier_name(value.display_name))
    from pg_catalog.jsonb_to_recordset(safe_suppliers)
      as value(client_reference_id text, display_name text, email text)
  ) then
    raise exception 'Setup supplier references and names must be unique'
      using errcode = '22023';
  end if;

  setup_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'inventoryItems', safe_inventory,
    'suppliers', safe_suppliers,
    'recipeMappings', safe_mappings,
    'posSales', safe_sales,
    'attachments', safe_attachments,
    'skippedRecipeIngredients', p_skipped_recipe_ingredients
  )::text);

  if exists (
    select 1 from public.audit_logs audit
    where audit.restaurant_id = p_restaurant_id
      and audit.action = 'setup_completed'
  ) then
    select audit.metadata into completed_setup_metadata
    from public.audit_logs audit
    where audit.restaurant_id = p_restaurant_id
      and audit.action = 'setup_completed'
      and audit.metadata->>'setup_fingerprint' = setup_fingerprint
    order by audit.created_at, audit.id
    limit 1;

    if completed_setup_metadata is not null then
      return pg_catalog.jsonb_build_object(
        'inventory_items_saved', coalesce((completed_setup_metadata->>'inventory_items_saved')::integer, 0),
        'supplier_recipients_saved', coalesce((completed_setup_metadata->>'supplier_recipients_saved')::integer, 0),
        'recipe_mappings_saved', coalesce((completed_setup_metadata->>'recipe_mappings_saved')::integer, 0),
        'pos_sales_rows_saved', coalesce((completed_setup_metadata->>'pos_sales_rows_saved')::integer, 0),
        'attachment_metadata_saved', coalesce((completed_setup_metadata->>'attachment_metadata_saved')::integer, 0),
        'skipped_recipe_ingredients', coalesce((completed_setup_metadata->>'skipped_recipe_ingredients')::integer, 0),
        'setup_fingerprint', setup_fingerprint,
        'outcome', 'already_applied'
      );
    end if;

    raise exception
      'Initial setup is already complete; use durable supplier workflows for later changes'
      using errcode = '55000',
        hint = 'Use create_supplier, rename_supplier, or reassign_inventory_item_supplier as appropriate.';
  end if;

  -- Name discovery is reachable only before the durable setup-completion
  -- boundary above. The resulting UUID map, never the name, authorizes each
  -- initial inventory write.
  for payload in
    select * from pg_catalog.jsonb_to_recordset(safe_suppliers) as value(
      client_reference_id text, display_name text, email text
    )
  loop
    payload.client_reference_id := pg_catalog.btrim(payload.client_reference_id);
    canonical_supplier_name := private.normalize_supplier_display_name(payload.display_name);
    payload.email := nullif(
      pg_catalog.lower(pg_catalog.btrim(payload.email) collate "C") collate "C",
      ''
    );
    if pg_catalog.length(payload.client_reference_id) not between 1 and 200
      or canonical_supplier_name is null
      or pg_catalog.length(canonical_supplier_name) > 160
      or coalesce(payload.display_name, '') collate "C" ~ '[[:cntrl:]]'
      or payload.email is not null and (
        pg_catalog.length(payload.email) not between 3 and 254
        or payload.email collate "C" ~ '[[:cntrl:]]'
        or payload.email collate "C" !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      )
    then
      raise exception 'Invalid supplier setup row' using errcode = '22023';
    end if;

    select supplier.id into resolved_supplier_id
    from public.suppliers supplier
    where supplier.restaurant_id = p_restaurant_id
      and supplier.normalized_name = private.normalize_supplier_name(canonical_supplier_name)
    for update;
    if resolved_supplier_id is null then
      insert into public.suppliers (restaurant_id, display_name, normalized_name)
      values (
        p_restaurant_id, canonical_supplier_name,
        private.normalize_supplier_name(canonical_supplier_name)
      ) returning id into resolved_supplier_id;
    end if;
    perform private.lock_supplier_authority(p_restaurant_id, resolved_supplier_id);
    supplier_ids := supplier_ids || pg_catalog.jsonb_build_object(
      payload.client_reference_id, resolved_supplier_id
    );

    select recipient.id into existing_id
    from public.supplier_recipients recipient
    where recipient.restaurant_id = p_restaurant_id
      and recipient.supplier_id = resolved_supplier_id
    for update;
    if existing_id is null then
      insert into public.supplier_recipients (
        restaurant_id, supplier_id, supplier_name, email
      ) values (
        p_restaurant_id, resolved_supplier_id, canonical_supplier_name, payload.email
      );
    else
      update public.supplier_recipients recipient
      set supplier_name = canonical_supplier_name, email = payload.email
      where recipient.restaurant_id = p_restaurant_id
        and recipient.id = existing_id;
    end if;
    supplier_count := supplier_count + 1;
  end loop;

  for payload in
    select * from pg_catalog.jsonb_to_recordset(safe_inventory) as value(
      item_name text, category text, unit text, current_quantity numeric,
      par_level numeric, reorder_threshold numeric,
      estimated_unit_cost numeric, supplier_client_reference_id text
    )
  loop
    payload.item_name := pg_catalog.btrim(payload.item_name);
    payload.category := pg_catalog.btrim(payload.category);
    payload.unit := pg_catalog.btrim(payload.unit);
    payload.supplier_client_reference_id := pg_catalog.btrim(
      payload.supplier_client_reference_id
    );
    begin
      resolved_supplier_id := (supplier_ids->>payload.supplier_client_reference_id)::uuid;
    exception when invalid_text_representation then
      resolved_supplier_id := null;
    end;
    select supplier.display_name into canonical_supplier_name
    from public.suppliers supplier
    where supplier.restaurant_id = p_restaurant_id
      and supplier.id = resolved_supplier_id;
    if pg_catalog.length(payload.item_name) not between 1 and 160
      or pg_catalog.length(payload.category) not between 1 and 120
      or pg_catalog.length(payload.unit) not between 1 and 40
      or resolved_supplier_id is null or canonical_supplier_name is null
      or payload.current_quantity is null or payload.current_quantity not between 0 and 1000000
      or payload.par_level is null or payload.par_level not between 0 and 1000000
      or payload.reorder_threshold is null or payload.reorder_threshold not between 0 and 1000000
      or payload.estimated_unit_cost is null or payload.estimated_unit_cost not between 0 and 1000000
    then
      raise exception 'Invalid inventory setup row' using errcode = '22023';
    end if;

    existing_id := null;
    previous_supplier_id := null;
    select item.id, item.supplier_id into existing_id, previous_supplier_id
    from public.inventory_items item
    where item.restaurant_id = p_restaurant_id
      and pg_catalog.lower(pg_catalog.btrim(item.item_name))
        = pg_catalog.lower(payload.item_name)
    order by item.last_updated, item.id limit 1 for update;

    for lock_supplier_id in
      select distinct candidate.id
      from unnest(array[previous_supplier_id, resolved_supplier_id]) candidate(id)
      where candidate.id is not null order by candidate.id
    loop
      perform private.lock_supplier_authority(p_restaurant_id, lock_supplier_id);
    end loop;

    if existing_id is null then
      insert into public.inventory_items (
        restaurant_id, item_name, category, unit, current_quantity, par_level,
        reorder_threshold, estimated_unit_cost, supplier_id, supplier_name
      ) values (
        p_restaurant_id, payload.item_name, payload.category, payload.unit,
        payload.current_quantity, payload.par_level, payload.reorder_threshold,
        payload.estimated_unit_cost, resolved_supplier_id, canonical_supplier_name
      );
    else
      if previous_supplier_id is distinct from resolved_supplier_id then
        if exists (
          select 1 from public.purchase_recommendations recommendation
          where recommendation.restaurant_id = p_restaurant_id
            and recommendation.inventory_item_id = existing_id
            and recommendation.status in ('approved', 'ordered')
        ) then
          raise exception 'Existing purchasing must be finished before setup supplier reassignment'
            using errcode = '55000';
        end if;
        delete from public.purchase_recommendations recommendation
        where recommendation.restaurant_id = p_restaurant_id
          and recommendation.inventory_item_id = existing_id
          and recommendation.status = 'pending';
      end if;
      update public.inventory_items item
      set item_name = payload.item_name, category = payload.category,
        unit = payload.unit, current_quantity = payload.current_quantity,
        par_level = payload.par_level,
        reorder_threshold = payload.reorder_threshold,
        estimated_unit_cost = payload.estimated_unit_cost,
        supplier_id = resolved_supplier_id,
        supplier_name = canonical_supplier_name,
        last_updated = pg_catalog.now()
      where item.restaurant_id = p_restaurant_id and item.id = existing_id;
    end if;
    inventory_count := inventory_count + 1;
  end loop;

  for payload in
    select * from pg_catalog.jsonb_to_recordset(safe_mappings) as value(
      menu_item_name text, inventory_item_name text,
      quantity_used_per_sale numeric, unit text
    )
  loop
    payload.menu_item_name := pg_catalog.btrim(payload.menu_item_name);
    payload.inventory_item_name := pg_catalog.btrim(payload.inventory_item_name);
    payload.unit := pg_catalog.btrim(payload.unit);
    if pg_catalog.length(payload.menu_item_name) not between 1 and 200
      or pg_catalog.length(payload.inventory_item_name) not between 1 and 160
      or pg_catalog.length(payload.unit) not between 1 and 40
      or payload.quantity_used_per_sale is null
      or payload.quantity_used_per_sale <= 0
      or payload.quantity_used_per_sale > 10000
    then
      raise exception 'Invalid recipe setup row' using errcode = '22023';
    end if;
    inventory_id := null;
    select item.id into inventory_id from public.inventory_items item
    where item.restaurant_id = p_restaurant_id
      and pg_catalog.lower(pg_catalog.btrim(item.item_name))
        = pg_catalog.lower(payload.inventory_item_name)
    order by item.last_updated, item.id limit 1 for update;
    if inventory_id is null then
      raise exception 'Recipe inventory item was not persisted' using errcode = '22023';
    end if;
    existing_id := null;
    select ingredient.id into existing_id
    from public.menu_item_ingredients ingredient
    where ingredient.restaurant_id = p_restaurant_id
      and ingredient.inventory_item_id = inventory_id
      and pg_catalog.lower(pg_catalog.btrim(ingredient.menu_item_name))
        = pg_catalog.lower(payload.menu_item_name)
    order by ingredient.id limit 1 for update;
    if existing_id is null then
      insert into public.menu_item_ingredients (
        restaurant_id, menu_item_name, inventory_item_id,
        quantity_used_per_sale, unit
      ) values (
        p_restaurant_id, payload.menu_item_name, inventory_id,
        payload.quantity_used_per_sale, payload.unit
      );
    else
      update public.menu_item_ingredients ingredient
      set menu_item_name = payload.menu_item_name,
        quantity_used_per_sale = payload.quantity_used_per_sale,
        unit = payload.unit
      where ingredient.restaurant_id = p_restaurant_id
        and ingredient.id = existing_id;
    end if;
    mapping_count := mapping_count + 1;
  end loop;

  for payload in
    select * from pg_catalog.jsonb_to_recordset(safe_sales) as value(
      source_record_id text, sale_date date, item_name text, category text,
      quantity_sold numeric, gross_sales numeric, net_sales numeric, source_pos text
    )
  loop
    payload.source_record_id := pg_catalog.btrim(payload.source_record_id);
    payload.item_name := pg_catalog.btrim(payload.item_name);
    payload.category := pg_catalog.btrim(payload.category);
    payload.source_pos := pg_catalog.btrim(payload.source_pos);
    if pg_catalog.length(payload.source_record_id) not between 1 and 200
      or payload.sale_date is null
      or pg_catalog.length(payload.item_name) not between 1 and 200
      or pg_catalog.length(payload.category) not between 1 and 120
      or payload.quantity_sold is null or payload.quantity_sold <= 0
      or payload.quantity_sold > 100000
      or payload.gross_sales is null or payload.gross_sales not between 0 and 10000000
      or payload.net_sales is null or payload.net_sales not between 0 and 10000000
      or payload.source_pos <> 'Manual CSV Upload'
    then
      raise exception 'Invalid POS setup row' using errcode = '22023';
    end if;
    insert into public.pos_sales (
      restaurant_id, source_record_id, sale_date, item_name, category,
      quantity_sold, gross_sales, net_sales, source_pos
    ) values (
      p_restaurant_id, payload.source_record_id, payload.sale_date,
      payload.item_name, payload.category, payload.quantity_sold,
      payload.gross_sales, payload.net_sales, payload.source_pos
    ) on conflict (restaurant_id, source_pos, source_record_id)
      where source_record_id is not null
    do update set sale_date = excluded.sale_date, item_name = excluded.item_name,
      category = excluded.category, quantity_sold = excluded.quantity_sold,
      gross_sales = excluded.gross_sales, net_sales = excluded.net_sales;
    sale_count := sale_count + 1;
  end loop;

  for payload in
    select * from pg_catalog.jsonb_to_recordset(safe_attachments) as value(
      client_reference_id text, kind text, label text, status text
    )
  loop
    payload.client_reference_id := pg_catalog.btrim(payload.client_reference_id);
    payload.label := pg_catalog.btrim(payload.label);
    if pg_catalog.length(payload.client_reference_id) not between 1 and 200
      or pg_catalog.length(payload.label) not between 1 and 240
      or payload.kind not in ('csv', 'screenshot')
      or payload.status not in ('queued', 'review_needed')
    then
      raise exception 'Invalid setup attachment row' using errcode = '22023';
    end if;
    existing_id := null;
    select attachment.id into existing_id from public.setup_attachments attachment
    where attachment.restaurant_id = p_restaurant_id
      and attachment.metadata->>'client_reference_id' = payload.client_reference_id
    order by attachment.created_at limit 1 for update;
    if existing_id is null then
      insert into public.setup_attachments (
        restaurant_id, kind, label, status, metadata, created_by
      ) values (
        p_restaurant_id, payload.kind, payload.label, payload.status,
        pg_catalog.jsonb_build_object(
          'source', 'setup_onboarding',
          'client_reference_id', payload.client_reference_id,
          'storage_status', 'metadata_only'
        ), auth.uid()
      );
    else
      update public.setup_attachments attachment
      set kind = payload.kind, label = payload.label, status = payload.status
      where attachment.restaurant_id = p_restaurant_id
        and attachment.id = existing_id;
    end if;
    attachment_count := attachment_count + 1;
  end loop;

  if not exists (
    select 1 from public.audit_logs audit
    where audit.restaurant_id = p_restaurant_id
      and audit.action = 'setup_completed'
      and audit.metadata->>'setup_fingerprint' = setup_fingerprint
  ) then
    insert into public.audit_logs (
      restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
    ) values (
      p_restaurant_id, auth.uid(), 'setup_completed', 'restaurants', p_restaurant_id,
      pg_catalog.jsonb_build_object(
        'inventory_items_saved', inventory_count,
        'supplier_recipients_saved', supplier_count,
        'recipe_mappings_saved', mapping_count,
        'pos_sales_rows_saved', sale_count,
        'attachment_metadata_saved', attachment_count,
        'skipped_recipe_ingredients', p_skipped_recipe_ingredients,
        'setup_fingerprint', setup_fingerprint,
        'supplier_identity', 'durable_uuid'
      )
    );
  end if;
  return pg_catalog.jsonb_build_object(
    'inventory_items_saved', inventory_count,
    'supplier_recipients_saved', supplier_count,
    'recipe_mappings_saved', mapping_count,
    'pos_sales_rows_saved', sale_count,
    'attachment_metadata_saved', attachment_count,
    'skipped_recipe_ingredients', p_skipped_recipe_ingredients,
    'setup_fingerprint', setup_fingerprint
  );
end;
$$;

revoke all on function public.save_restaurant_setup(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, integer
) from public, anon, authenticated, service_role;
grant execute on function public.save_restaurant_setup(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, integer
) to authenticated;

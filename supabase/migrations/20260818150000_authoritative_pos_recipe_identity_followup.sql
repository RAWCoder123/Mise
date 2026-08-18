-- MISE-002A follow-up: keep the historical migration chain intact while
-- aligning planning-sales aggregation with the expanded provider identity row.

create or replace function public.fetch_planning_sales(
  p_restaurant_id uuid,
  p_service_days integer default 28
)
returns setof public.pos_sales
language plpgsql
security definer
set search_path = ''
as $$
declare
  operating_date date;
begin
  if auth.uid() is null or not private.is_restaurant_member(p_restaurant_id) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  if p_service_days is null or p_service_days not between 7 and 60 then
    raise exception 'Service-day window must be between 7 and 60 days' using errcode = '22023';
  end if;

  begin
    select timezone(restaurant.timezone, now())::date into operating_date
    from public.restaurants restaurant
    where restaurant.id = p_restaurant_id;
  exception
    when invalid_parameter_value then operating_date := current_date;
  end;
  operating_date := coalesce(operating_date, current_date);

  return query
  with historical_service_days as (
    select distinct sale.sale_date
    from public.pos_sales sale
    where sale.restaurant_id = p_restaurant_id
      and sale.sale_date < operating_date
    order by sale.sale_date desc
    limit p_service_days
  ),
  windowed_sales as (
    select *
    from public.pos_sales sale
    where sale.restaurant_id = p_restaurant_id
      and (
        sale.sale_date = operating_date
        or sale.sale_date in (select day.sale_date from historical_service_days day)
      )
  ),
  provider_complete as (
    select
      (array_agg(sale.id order by sale.id))[1] as id,
      p_restaurant_id as restaurant_id,
      sale.sale_date,
      sale.item_name,
      sale.category,
      sum(sale.quantity_sold) as quantity_sold,
      sum(sale.gross_sales) as gross_sales,
      sum(sale.net_sales) as net_sales,
      min(sale.source_pos) as source_pos,
      max(sale.created_at) as created_at,
      null::text as source_record_id,
      sale.provider_catalog_item_id,
      sale.provider_location_id,
      sale.provider_variation_id
    from windowed_sales sale
    where (
      lower(coalesce(sale.source_pos, '')) in ('square', 'toast', 'clover', 'lightspeed')
      or sale.provider_location_id is not null
      or sale.provider_catalog_item_id is not null
      or sale.provider_variation_id is not null
    )
      and sale.provider_location_id is not null
      and sale.provider_catalog_item_id is not null
      and sale.provider_variation_id is not null
    group by sale.sale_date, sale.source_pos, sale.provider_location_id, sale.provider_catalog_item_id, sale.provider_variation_id, sale.item_name, sale.category
  ),
  provider_incomplete as (
    select
      sale.id,
      sale.restaurant_id,
      sale.sale_date,
      sale.item_name,
      sale.category,
      sale.quantity_sold,
      sale.gross_sales,
      sale.net_sales,
      sale.source_pos,
      sale.created_at,
      sale.source_record_id,
      sale.provider_catalog_item_id,
      sale.provider_location_id,
      sale.provider_variation_id
    from windowed_sales sale
    where (
      lower(coalesce(sale.source_pos, '')) in ('square', 'toast', 'clover', 'lightspeed')
      or sale.provider_location_id is not null
      or sale.provider_catalog_item_id is not null
      or sale.provider_variation_id is not null
    )
      and not (
        sale.provider_location_id is not null
        and sale.provider_catalog_item_id is not null
        and sale.provider_variation_id is not null
      )
  ),
  manual_sales as (
    select
      (array_agg(sale.id order by sale.id))[1] as id,
      p_restaurant_id as restaurant_id,
      sale.sale_date,
      sale.item_name,
      sale.category,
      sum(sale.quantity_sold) as quantity_sold,
      sum(sale.gross_sales) as gross_sales,
      sum(sale.net_sales) as net_sales,
      case
        when count(distinct sale.source_pos) = 1 then min(sale.source_pos)
        else 'Mise aggregate'
      end as source_pos,
      max(sale.created_at) as created_at,
      null::text as source_record_id,
      null::text as provider_catalog_item_id,
      null::text as provider_location_id,
      null::text as provider_variation_id
    from windowed_sales sale
    where not (
      lower(coalesce(sale.source_pos, '')) in ('square', 'toast', 'clover', 'lightspeed')
      or sale.provider_location_id is not null
      or sale.provider_catalog_item_id is not null
      or sale.provider_variation_id is not null
    )
    group by sale.sale_date, sale.item_name, sale.category
  )
  select * from provider_complete
  union all
  select * from provider_incomplete
  union all
  select * from manual_sales
  order by sale_date desc, source_pos, provider_location_id nulls last, provider_catalog_item_id nulls last, provider_variation_id nulls last, item_name, id;
end;
$$;

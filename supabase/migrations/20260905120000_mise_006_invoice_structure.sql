-- MISE-006: let purchase_lines hold structures a real invoice was proven to
-- contain. Additive and supplier-neutral. Nothing here parses a document,
-- infers a supplier, or optimizes for a layout.
--
-- The sole evidentiary basis is one photographed Costco Business Center
-- invoice, order 1032136951, dated 2023-05-26, from a business in Seattle that
-- is not a design partner. It proves these structures EXIST. It proves nothing
-- about what is typical, and no column below assumes its layout.

-- ---------------------------------------------------------------- quantities
-- A real invoice separates what was ordered from what arrived, and the two
-- diverge (68.00 -> 71.40, 24.00 -> 24.64, 5.00 -> 5.00). Both are stored as
-- non-negative magnitudes, exactly like `quantity`: direction stays in
-- line_type, so a flipped sign remains a parse error.
--
-- `quantity` is RETAINED, not generated. Two reasons, one structural and one
-- semantic. Structurally, `signed_quantity` is already a stored generated
-- column derived from `quantity`, and Postgres forbids a generated column from
-- referencing another generated column, so `quantity` cannot itself become
-- generated without dismantling the credit modelling from MISE-004C.
-- Semantically, `quantity` is redefined here as the billed quantity: the one
-- the extended price was computed from. That is the only definition under
-- which the money on the line can be checked at all.
alter table public.purchase_lines
  add column if not exists ordered_quantity numeric,
  add column if not exists shipped_quantity numeric,
  add column if not exists supplier_item_code text,
  add column if not exists row_class text not null default 'merchandise',
  add column if not exists source_page integer,
  add column if not exists extraction_method text,
  add column if not exists parser_version text,
  add column if not exists extraction_confidence text;

alter table public.purchase_lines
  add constraint purchase_lines_ordered_quantity_check check (
    ordered_quantity is null
    or (ordered_quantity >= 0 and ordered_quantity <= 1000000000)
  ),
  add constraint purchase_lines_shipped_quantity_check check (
    shipped_quantity is null
    or (shipped_quantity >= 0 and shipped_quantity <= 1000000000)
  ),
  -- Supplier-scoped identity. Deliberately NOT unique: one invoice cannot
  -- prove a code is reused over time, and codes from different suppliers may
  -- collide. normalized_item_key remains the cross-supplier key.
  add constraint purchase_lines_supplier_item_code_check check (
    supplier_item_code is null
    or (
      pg_catalog.length(pg_catalog.btrim(supplier_item_code)) between 1 and 80
      and supplier_item_code !~ '[[:cntrl:]]'
    )
  ),
  -- Every value is justified by the fixture or by structural necessity:
  --   merchandise        the purchased item lines
  --   section_header     "Cooler Items", "Dry Items" - grouping, no amounts
  --   charge             Delivery Surcharge
  --   tax                Sales Tax, which is remitted rather than paid for goods
  --   document_adjustment Order Adjustment, applying to the order not a line
  add constraint purchase_lines_row_class_check check (
    row_class in (
      'merchandise', 'section_header', 'charge', 'tax', 'document_adjustment'
    )
  ),
  -- A grouping header carries no money and no goods. Storing amounts on one
  -- would be recording something the document did not say.
  add constraint purchase_lines_section_header_check check (
    row_class <> 'section_header'
    or (
      quantity is null and ordered_quantity is null and shipped_quantity is null
      and unit_price is null and extended_price is null
    )
  ),
  add constraint purchase_lines_source_page_check check (
    source_page is null or (source_page >= 1 and source_page <= 10000)
  ),
  --   manual_entry  the pre-existing hand-entry path
  --   pdf_text      a document read as text
  --   ocr           a document read as pixels, as this fixture was
  add constraint purchase_lines_extraction_method_check check (
    extraction_method is null
    or extraction_method in ('manual_entry', 'pdf_text', 'ocr')
  ),
  add constraint purchase_lines_parser_version_check check (
    parser_version is null
    or (
      pg_catalog.length(pg_catalog.btrim(parser_version)) between 1 and 80
      and parser_version !~ '[[:cntrl:]]'
    )
  ),
  -- Separate axis from parse_confidence. This one answers "are these the right
  -- characters"; parse_confidence answers "do these fields agree with each
  -- other". Null where nothing was extracted, as with manual entry.
  add constraint purchase_lines_extraction_confidence_check check (
    extraction_confidence is null
    or extraction_confidence in ('exact', 'uncertain', 'unreadable')
  );

create index if not exists purchase_lines_supplier_item_code_idx
on public.purchase_lines (restaurant_id, supplier_scope, supplier_item_code)
where supplier_item_code is not null;

comment on column public.purchase_lines.quantity is
  'The billed quantity: the one the extended price was computed from. Ordered and shipped are recorded separately.';
comment on column public.purchase_lines.ordered_quantity is
  'What the restaurant asked for, where the document states it separately. Never assumed equal to shipped.';
comment on column public.purchase_lines.shipped_quantity is
  'What the supplier recorded as sent. May exceed or fall short of ordered; divergence is normal, not an error.';
comment on column public.purchase_lines.supplier_item_code is
  'Supplier-scoped item identity as printed. Not globally unique, not proven stable over time, and not a cross-supplier key.';
comment on column public.purchase_lines.row_class is
  'What kind of row this is. Only merchandise rows reach net quantity and net spend; the rest are stored for audit.';
comment on column public.purchase_lines.extraction_confidence is
  'How sure extraction was that it read the characters correctly. Independent of parse_confidence, which it may cap but never raise.';

-- --------------------------------------------------- confidence interaction
-- A fourth ceiling. Characters you are not sure you read cannot support a
-- confirmed claim about the fields made of them, so extraction caps parse.
-- It never raises it, and the two columns remain independently stored: a line
-- can be read perfectly and still contradict itself, and a line can be blurry
-- and still be internally consistent.
create or replace function private.purchase_line_extraction_ceiling(p_extraction text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case p_extraction
    when 'unreadable' then 'could_not_verify'
    when 'uncertain' then 'estimated'
    else 'confirmed'
  end;
$$;

revoke all on function private.purchase_line_extraction_ceiling(text)
from public, anon, authenticated, service_role;

create or replace function private.resolve_purchase_line_confidence(
  p_requested text,
  p_quantity numeric,
  p_unit_of_measure text,
  p_unit_price numeric,
  p_extended_price numeric,
  p_normalized_item_key text,
  p_flags text[],
  p_extraction_confidence text default null
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case least(
    private.purchase_line_confidence_rank(p_requested),
    private.purchase_line_confidence_rank(
      case
        when p_quantity is null
          or p_unit_of_measure is null
          or p_unit_price is null
          or p_extended_price is null
          or p_normalized_item_key is null
        then 'could_not_verify'
        else 'confirmed'
      end
    ),
    private.purchase_line_confidence_rank(
      private.purchase_line_consistency_ceiling(p_flags)
    ),
    private.purchase_line_confidence_rank(
      private.purchase_line_extraction_ceiling(p_extraction_confidence)
    )
  )
    when 2 then 'confirmed'
    when 1 then 'estimated'
    else 'could_not_verify'
  end;
$$;

revoke all on function private.resolve_purchase_line_confidence(
  text, numeric, text, numeric, numeric, text, text[], text
) from public, anon, authenticated, service_role;

-- The database refuses an over-confident line whatever writes it.
alter table public.purchase_lines
  add constraint purchase_lines_extraction_confidence_ceiling_check check (
    private.purchase_line_confidence_rank(parse_confidence)
      <= private.purchase_line_confidence_rank(
           private.purchase_line_extraction_ceiling(extraction_confidence))
  );

-- -------------------------------------------------------------- the writer
-- Reads the new fields off the line payload. Everything is optional, so a
-- caller that knows nothing about invoice structure still writes valid rows.
create or replace function private.append_purchase_line(
  p_restaurant_id uuid,
  p_supplier_id uuid,
  p_source text,
  p_source_document_reference text,
  p_correlation_id uuid,
  p_line jsonb,
  p_line_index integer,
  p_revision integer,
  p_supersedes_line_id uuid,
  p_allow_conflict boolean,
  p_line_type text default null
)
returns public.purchase_lines
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_description text;
  normalized_key text;
  quantity numeric;
  unit_of_measure text;
  pack_size text;
  stated_pack_size text;
  described_pack_size text;
  consistency_flags text[];
  unit_price numeric;
  extended_price numeric;
  currency text;
  transaction_date date;
  received_date date;
  requested_confidence text;
  resolved_line_type text;
  credited_line_id uuid;
  ordered_quantity numeric;
  shipped_quantity numeric;
  supplier_item_code text;
  resolved_row_class text;
  source_page integer;
  extraction_method text;
  parser_version text;
  extraction_confidence text;
  line_row public.purchase_lines%rowtype;
begin
  if pg_catalog.jsonb_typeof(p_line) <> 'object' then
    raise exception 'Each purchase line must be an object' using errcode = '22023';
  end if;

  resolved_line_type := coalesce(
    p_line_type, private.purchase_line_text(p_line, 'lineType', 20));
  if resolved_line_type is null or resolved_line_type not in ('purchase', 'credit') then
    raise exception 'Purchase line % must state whether it is a purchase or a credit', p_line_index
      using errcode = '22023';
  end if;

  resolved_row_class := coalesce(
    private.purchase_line_text(p_line, 'rowClass', 40), 'merchandise');
  if resolved_row_class not in (
    'merchandise', 'section_header', 'charge', 'tax', 'document_adjustment'
  ) then
    raise exception 'Purchase line % states an unknown row class', p_line_index
      using errcode = '22023';
  end if;

  credited_line_id := case
    when pg_catalog.jsonb_typeof(p_line -> 'creditsLineId') = 'string'
      then (p_line ->> 'creditsLineId')::uuid
  end;
  if credited_line_id is not null then
    if resolved_line_type <> 'credit' then
      raise exception 'Only a credit line may reference the line it offsets'
        using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.purchase_lines original
      where original.restaurant_id = p_restaurant_id
        and original.id = credited_line_id
        and original.supplier_scope = coalesce(
          p_supplier_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) then
      raise exception 'Credited purchase line is not available for this supplier'
        using errcode = '42501';
    end if;
  end if;

  raw_description := private.purchase_line_text(p_line, 'rawItemDescription', 500);
  if raw_description is null then
    raise exception 'Purchase line % has no readable source description', p_line_index
      using errcode = '22023';
  end if;

  requested_confidence := private.purchase_line_text(p_line, 'parseConfidence', 40);
  if requested_confidence is null
    or requested_confidence not in ('confirmed', 'estimated', 'could_not_verify')
  then
    raise exception 'Purchase line % has no stated parse confidence', p_line_index
      using errcode = '22023';
  end if;

  extraction_confidence := private.purchase_line_text(p_line, 'extractionConfidence', 40);
  if extraction_confidence is not null
    and extraction_confidence not in ('exact', 'uncertain', 'unreadable')
  then
    raise exception 'Purchase line % states an unknown extraction confidence', p_line_index
      using errcode = '22023';
  end if;
  extraction_method := private.purchase_line_text(p_line, 'extractionMethod', 40);
  if extraction_method is not null
    and extraction_method not in ('manual_entry', 'pdf_text', 'ocr')
  then
    raise exception 'Purchase line % states an unknown extraction method', p_line_index
      using errcode = '22023';
  end if;
  parser_version := private.purchase_line_text(p_line, 'parserVersion', 80);
  source_page := case
    when pg_catalog.jsonb_typeof(p_line -> 'sourcePage') = 'number'
      then (p_line ->> 'sourcePage')::integer
  end;
  supplier_item_code := private.purchase_line_text(p_line, 'supplierItemCode', 80);

  if pg_catalog.jsonb_typeof(p_line -> 'transactionDate') <> 'string' then
    raise exception 'Purchase line % has no transaction date', p_line_index
      using errcode = '22023';
  end if;
  transaction_date := (p_line ->> 'transactionDate')::date;
  received_date := case
    when pg_catalog.jsonb_typeof(p_line -> 'receivedDate') = 'string'
      then (p_line ->> 'receivedDate')::date
  end;

  normalized_key := private.normalize_purchase_item_key(raw_description);
  quantity := private.purchase_line_amount(p_line, 'quantity', 1000000000);
  ordered_quantity := private.purchase_line_amount(p_line, 'orderedQuantity', 1000000000);
  shipped_quantity := private.purchase_line_amount(p_line, 'shippedQuantity', 1000000000);
  unit_of_measure := private.purchase_line_text(p_line, 'unitOfMeasure', 80);
  stated_pack_size := private.purchase_line_text(p_line, 'packSize', 80);
  described_pack_size := private.extract_purchase_pack_size(raw_description);
  pack_size := coalesce(stated_pack_size, described_pack_size);
  unit_price := private.purchase_line_amount(p_line, 'unitPrice', 1000000000);
  extended_price := private.purchase_line_amount(p_line, 'extendedPrice', 1000000000000);
  currency := private.purchase_line_text(p_line, 'currency', 3);
  if currency is not null and currency !~ '^[A-Z]{3}$' then
    raise exception 'Purchase line % has an unusable currency code', p_line_index
      using errcode = '22023';
  end if;
  if currency is null and (unit_price is not null or extended_price is not null) then
    raise exception 'Purchase line % states a price without a currency', p_line_index
      using errcode = '22023';
  end if;

  -- The arithmetic property checks the BILLED quantity against extended price,
  -- because that is the pair the document's own money was computed from.
  -- Checking ordered against extended would flag every catch-weight line on
  -- the fixture as inconsistent when the invoice is perfectly correct.
  consistency_flags := private.purchase_line_consistency_flags(
    quantity, unit_of_measure, pack_size, unit_price, extended_price,
    transaction_date, received_date, stated_pack_size, described_pack_size
  );

  insert into public.purchase_lines (
    restaurant_id, supplier_id, source, source_document_reference, line_index,
    revision, raw_item_description, normalized_item_key, quantity,
    unit_of_measure, pack_size, unit_price, extended_price, currency,
    transaction_date, received_date, correlation_id, parse_confidence,
    consistency_flags, line_type, credits_line_id, supersedes_line_id,
    ordered_quantity, shipped_quantity, supplier_item_code, row_class,
    source_page, extraction_method, parser_version, extraction_confidence,
    recorded_by
  ) values (
    p_restaurant_id, p_supplier_id, p_source, p_source_document_reference,
    p_line_index, p_revision, raw_description, normalized_key, quantity,
    unit_of_measure, pack_size, unit_price, extended_price, currency,
    transaction_date, received_date, p_correlation_id,
    private.resolve_purchase_line_confidence(
      requested_confidence, quantity, unit_of_measure, unit_price,
      extended_price, normalized_key, consistency_flags, extraction_confidence
    ),
    consistency_flags, resolved_line_type, credited_line_id,
    p_supersedes_line_id, ordered_quantity, shipped_quantity,
    supplier_item_code, resolved_row_class, source_page, extraction_method,
    parser_version, extraction_confidence, auth.uid()
  )
  on conflict on constraint purchase_lines_document_line_key do nothing
  returning * into line_row;

  if line_row.id is null and not p_allow_conflict then
    raise exception 'Purchase line % already exists at this document position', p_line_index
      using errcode = '23505';
  end if;
  return line_row;
end;
$$;

revoke all on function private.append_purchase_line(
  uuid, uuid, text, text, uuid, jsonb, integer, integer, uuid, boolean, text
) from public, anon, authenticated, service_role;

-- ------------------------------------------------------------- the aggregate
-- Non-merchandise rows are stored for audit and must never reach net quantity
-- or net spend. A delivery surcharge is real money, but it is not an item, and
-- folding it into an item's net would misstate both.
create or replace function public.list_purchase_line_net_by_item(p_restaurant_id uuid)
returns table (
  supplier_id uuid,
  normalized_item_key text,
  unit_of_measure text,
  currency text,
  purchase_line_count bigint,
  credit_line_count bigint,
  net_quantity numeric,
  net_extended_price numeric,
  unmatched_credit boolean,
  first_transaction_date date,
  last_transaction_date date
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    line.supplier_id,
    line.normalized_item_key,
    line.unit_of_measure,
    line.currency,
    pg_catalog.count(*) filter (where line.line_type = 'purchase'),
    pg_catalog.count(*) filter (where line.line_type = 'credit'),
    pg_catalog.sum(line.signed_quantity),
    pg_catalog.sum(line.signed_extended_price),
    pg_catalog.count(*) filter (where line.line_type = 'purchase') = 0,
    pg_catalog.min(line.transaction_date),
    pg_catalog.max(line.transaction_date)
  from public.purchase_lines line
  where line.restaurant_id = p_restaurant_id
    and line.row_class = 'merchandise'
    and auth.uid() is not null
    and private.is_restaurant_member(p_restaurant_id)
    and not exists (
      select 1 from public.purchase_lines successor
      where successor.restaurant_id = line.restaurant_id
        and successor.supersedes_line_id = line.id
    )
  group by line.supplier_id, line.normalized_item_key, line.unit_of_measure, line.currency
  order by line.normalized_item_key, line.supplier_id, line.unit_of_measure, line.currency
$$;

revoke all on function public.list_purchase_line_net_by_item(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.list_purchase_line_net_by_item(uuid)
to authenticated;

comment on function public.list_purchase_line_net_by_item(uuid) is
  'Factual net quantity and spend per merchandise item. Non-merchandise rows are excluded. Credits whose item key matches no purchase are flagged unmatched, never netted silently. It states what was recorded and nothing more.';

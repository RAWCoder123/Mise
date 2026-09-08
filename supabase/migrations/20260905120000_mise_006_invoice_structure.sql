-- MISE-006: let purchase_lines hold structures real invoices were proven to
-- contain. Additive and supplier-neutral. Nothing here parses a document,
-- infers a supplier, or optimizes for a layout.
--
-- Every structure below comes from the enumerated list in the MISE-006 brief.
-- No source image, real price, real item code, or customer identity enters
-- this repository, and every test fixture is synthetic: it reproduces a shape,
-- never a document.

-- ---------------------------------------------------------------- quantities
-- Three quantities, each with its own unit, because a catch-weight line is
-- ordered in one unit and billed in another. All are non-negative magnitudes:
-- direction stays in line_type, so a flipped sign remains a parse error.
--
-- `quantity` is RETAINED as the sole writable storage of the billed quantity,
-- and `billed_quantity` is added as a generated mirror of it. Two reasons.
-- Structurally, `signed_quantity` is already a stored generated column derived
-- from `quantity`, and Postgres forbids a generated column from referencing
-- another, so `quantity` cannot itself become generated without dismantling
-- the MISE-004C credit modelling. Semantically, two independently writable
-- columns for one fact is a divergence bug waiting to happen -- exactly the
-- class of defect this ledger exists to prevent -- so the new name is provided
-- as a mirror that cannot disagree rather than as a second source of truth.
alter table public.purchase_lines
  add column if not exists ordered_quantity numeric,
  add column if not exists ordered_unit_of_measure text,
  add column if not exists shipped_quantity numeric,
  add column if not exists shipped_unit_of_measure text,
  add column if not exists supplier_item_code text,
  add column if not exists row_class text not null default 'merchandise',
  add column if not exists adjusts_line_id uuid,
  add column if not exists source_page integer,
  add column if not exists extraction_method text,
  add column if not exists parser_version text,
  add column if not exists extraction_confidence text,
  add column if not exists document_line_count integer;

alter table public.purchase_lines
  add column if not exists billed_quantity numeric
    generated always as (quantity) stored,
  add column if not exists billed_unit_of_measure text
    generated always as (unit_of_measure) stored;

alter table public.purchase_lines
  add constraint purchase_lines_ordered_quantity_check check (
    ordered_quantity is null
    or (ordered_quantity >= 0 and ordered_quantity <= 1000000000)
  ),
  add constraint purchase_lines_shipped_quantity_check check (
    shipped_quantity is null
    or (shipped_quantity >= 0 and shipped_quantity <= 1000000000)
  ),
  add constraint purchase_lines_ordered_unit_check check (
    ordered_unit_of_measure is null
    or (
      pg_catalog.length(pg_catalog.btrim(ordered_unit_of_measure)) between 1 and 80
      and ordered_unit_of_measure !~ '[[:cntrl:]]'
    )
  ),
  add constraint purchase_lines_shipped_unit_check check (
    shipped_unit_of_measure is null
    or (
      pg_catalog.length(pg_catalog.btrim(shipped_unit_of_measure)) between 1 and 80
      and shipped_unit_of_measure !~ '[[:cntrl:]]'
    )
  ),
  -- Stored verbatim, never parsed for internal structure. Supplier-scoped and
  -- deliberately NOT unique: codes from different suppliers may collide, and
  -- nothing observed so far shows a code being reused across documents, which
  -- is the premise a uniqueness constraint would assert.
  add constraint purchase_lines_supplier_item_code_check check (
    supplier_item_code is null
    or (
      pg_catalog.length(pg_catalog.btrim(supplier_item_code)) between 1 and 80
      and supplier_item_code !~ '[[:cntrl:]]'
    )
  ),
  -- Values are drawn only from the structures the brief enumerates:
  --   merchandise      the purchased item lines
  --   section_header   a grouping row carrying no amounts
  --   charge           a non-merchandise amount such as a fuel charge
  --   tax              remitted rather than paid to the supplier for goods
  --   subtotal         a running or final total row
  --   line_adjustment  a discount or adjustment against one merchandise line
  add constraint purchase_lines_row_class_check check (
    row_class in (
      'merchandise', 'section_header', 'charge', 'tax', 'subtotal',
      'line_adjustment'
    )
  ),
  -- A grouping header carries no money, no goods, and modifies nothing.
  add constraint purchase_lines_section_header_check check (
    row_class <> 'section_header'
    or (
      quantity is null and ordered_quantity is null and shipped_quantity is null
      and unit_price is null and extended_price is null
      and adjusts_line_id is null
    )
  ),
  -- A line adjustment is a row that references the line it modifies, never a
  -- column on that line and never a credit: a supplier discount is a change to
  -- what was charged, not money returned, so line_type stays 'purchase'.
  add constraint purchase_lines_adjustment_shape_check check (
    (row_class = 'line_adjustment' and adjusts_line_id is not null
      and line_type = 'purchase')
    or (row_class <> 'line_adjustment' and adjusts_line_id is null)
  ),
  add constraint purchase_lines_adjusts_fkey foreign key (restaurant_id, adjusts_line_id)
    references public.purchase_lines (restaurant_id, id),
  add constraint purchase_lines_self_adjust_check check (
    adjusts_line_id is null or adjusts_line_id <> id
  ),
  add constraint purchase_lines_source_page_check check (
    source_page is null or (source_page >= 1 and source_page <= 10000)
  ),
  --   manual_entry  the pre-existing hand-entry path
  --   pdf_text      a document read as text
  --   ocr           a document read as pixels
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
  -- A separate axis from parse_confidence. This one answers "are these the
  -- right characters"; parse_confidence answers "do these fields agree with
  -- each other". Null where nothing was extracted, as with manual entry.
  add constraint purchase_lines_extraction_confidence_check check (
    extraction_confidence is null
    or extraction_confidence in ('exact', 'uncertain', 'unreadable')
  ),
  -- The count a document's own footer stated, carried on each of its lines so
  -- extraction completeness can be checked without a second table.
  add constraint purchase_lines_document_line_count_check check (
    document_line_count is null
    or (document_line_count >= 0 and document_line_count <= 100000)
  );

create index if not exists purchase_lines_supplier_item_code_idx
on public.purchase_lines (restaurant_id, supplier_scope, supplier_item_code)
where supplier_item_code is not null;
create index if not exists purchase_lines_adjusts_idx
on public.purchase_lines (restaurant_id, adjusts_line_id)
where adjusts_line_id is not null;

comment on column public.purchase_lines.quantity is
  'The billed quantity, and the sole writable storage for it. billed_quantity mirrors this column and cannot disagree with it.';
comment on column public.purchase_lines.billed_quantity is
  'Generated mirror of quantity. The 004A-C arithmetic property multiplies this quantity, never ordered or shipped.';
comment on column public.purchase_lines.ordered_quantity is
  'What the restaurant asked for, where the document states it separately. Never assumed equal to shipped or billed.';
comment on column public.purchase_lines.shipped_quantity is
  'What the supplier recorded as sent. Divergence from ordered is normal, not an error.';
comment on column public.purchase_lines.supplier_item_code is
  'Supplier-scoped item identity, stored verbatim and never parsed. Not globally unique and not a cross-supplier key.';
comment on column public.purchase_lines.row_class is
  'What kind of row this is. Only merchandise reaches net quantity and net spend; the rest are stored for audit.';
comment on column public.purchase_lines.adjusts_line_id is
  'The merchandise line this adjustment modifies. An adjustment is a row, never a column, and never a credit.';
comment on column public.purchase_lines.document_line_count is
  'The line count the source document footer stated, for reconciling extraction completeness.';
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
    -- p_quantity is the billed quantity. A line whose billed quantity could
    -- not be identified is could_not_verify, and the writer never tries
    -- ordered or shipped in its place to see which one reconciles.
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
  ordered_unit text;
  shipped_quantity numeric;
  shipped_unit text;
  supplier_item_code text;
  resolved_row_class text;
  adjusted_line_id uuid;
  source_page integer;
  extraction_method text;
  parser_version text;
  extraction_confidence text;
  document_line_count integer;
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
    'merchandise', 'section_header', 'charge', 'tax', 'subtotal', 'line_adjustment'
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

  -- An adjustment must name a merchandise line of the same supplier. It is a
  -- change to what was charged for that item, so it can attach to nothing else.
  adjusted_line_id := case
    when pg_catalog.jsonb_typeof(p_line -> 'adjustsLineId') = 'string'
      then (p_line ->> 'adjustsLineId')::uuid
  end;
  if adjusted_line_id is not null then
    if resolved_row_class <> 'line_adjustment' then
      raise exception 'Only a line adjustment may reference the line it modifies'
        using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.purchase_lines adjusted
      where adjusted.restaurant_id = p_restaurant_id
        and adjusted.id = adjusted_line_id
        and adjusted.row_class = 'merchandise'
        and adjusted.supplier_scope = coalesce(
          p_supplier_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) then
      raise exception 'Adjusted purchase line is not available for this supplier'
        using errcode = '42501';
    end if;
  elsif resolved_row_class = 'line_adjustment' then
    raise exception 'Purchase line % adjusts nothing and cannot be a line adjustment', p_line_index
      using errcode = '22023';
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
  document_line_count := case
    when pg_catalog.jsonb_typeof(p_line -> 'documentLineCount') = 'number'
      then (p_line ->> 'documentLineCount')::integer
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
  -- `quantity` is the billed quantity. Ordered and shipped are recorded beside
  -- it and are never substituted for it.
  quantity := private.purchase_line_amount(p_line, 'quantity', 1000000000);
  ordered_quantity := private.purchase_line_amount(p_line, 'orderedQuantity', 1000000000);
  shipped_quantity := private.purchase_line_amount(p_line, 'shippedQuantity', 1000000000);
  unit_of_measure := private.purchase_line_text(p_line, 'unitOfMeasure', 80);
  ordered_unit := private.purchase_line_text(p_line, 'orderedUnitOfMeasure', 80);
  shipped_unit := private.purchase_line_text(p_line, 'shippedUnitOfMeasure', 80);
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

  -- The arithmetic property multiplies the BILLED quantity against extended
  -- price, because that is the pair the document's own money was computed
  -- from. Checking ordered would flag every catch-weight line as inconsistent
  -- when the invoice is correct.
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
    ordered_quantity, ordered_unit_of_measure, shipped_quantity,
    shipped_unit_of_measure, supplier_item_code, row_class, adjusts_line_id,
    source_page, extraction_method, parser_version, extraction_confidence,
    document_line_count, recorded_by
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
    p_supersedes_line_id, ordered_quantity, ordered_unit, shipped_quantity,
    shipped_unit, supplier_item_code, resolved_row_class, adjusted_line_id,
    source_page, extraction_method, parser_version, extraction_confidence,
    document_line_count, auth.uid()
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
-- Non-merchandise rows are stored for audit and reach no aggregate. A fuel
-- charge is real money and a subtotal is a real number, but neither is an
-- item, and folding either into an item's net would misstate both.
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

-- ---------------------------------------------------- extraction completeness
-- Reports the footer count beside what was actually recorded. It deliberately
-- returns BOTH interpretations rather than choosing one, because whether a
-- document's stated line count includes its non-merchandise rows is not
-- something any document examined so far has settled.
create or replace function public.list_purchase_document_completeness(p_restaurant_id uuid)
returns table (
  supplier_id uuid,
  source_document_reference text,
  stated_line_count integer,
  recorded_row_count bigint,
  recorded_merchandise_count bigint,
  matches_row_count boolean,
  matches_merchandise_count boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    line.supplier_id,
    line.source_document_reference,
    pg_catalog.max(line.document_line_count),
    pg_catalog.count(*),
    pg_catalog.count(*) filter (where line.row_class = 'merchandise'),
    pg_catalog.max(line.document_line_count) = pg_catalog.count(*),
    pg_catalog.max(line.document_line_count)
      = pg_catalog.count(*) filter (where line.row_class = 'merchandise')
  from public.purchase_lines line
  where line.restaurant_id = p_restaurant_id
    and auth.uid() is not null
    and private.is_restaurant_member(p_restaurant_id)
    and not exists (
      select 1 from public.purchase_lines successor
      where successor.restaurant_id = line.restaurant_id
        and successor.supersedes_line_id = line.id
    )
  group by line.supplier_id, line.source_document_reference
  order by line.source_document_reference, line.supplier_id
$$;

revoke all on function public.list_purchase_document_completeness(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.list_purchase_document_completeness(uuid)
to authenticated;

comment on function public.list_purchase_document_completeness(uuid) is
  'Compares a document footer line count against what was recorded, reporting both possible interpretations rather than assuming one.';

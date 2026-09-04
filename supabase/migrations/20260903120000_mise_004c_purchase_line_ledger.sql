-- MISE-004C: the canonical append-only record of every item a restaurant has
-- purchased. This is substrate only. Nothing here predicts, recommends, orders,
-- infers depletion, or matches items across suppliers. Normalization is
-- deterministic string work; ambiguity is preserved rather than resolved.

-- The pack/size vocabulary is duplicated in services/domain/purchaseLines.ts.
-- tests/purchaseLineLedgerMigration.test.ts fails if the two drift apart.
create or replace function private.purchase_line_pack_units()
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select 'bottles|gallons|gallon|liters|litres|quarts|boxes|cases|count|'
    || 'dozen|grams|liter|litre|packs|pints|quart|trays|bags|cans|case|'
    || 'each|gals|gram|jars|pack|pint|tray|bag|box|btl|can|cnt|doz|gal|'
    || 'jar|kgs|lbs|ltr|mgs|ozs|pts|qts|cs|ct|dz|ea|kg|lb|lt|mg|ml|oz|'
    || 'pk|pt|qt|g|l';
$$;

-- `6/1gal` and `12 x 32 oz` first, then a bare `5 lb`. Postgres prefers the
-- longest overall match, so the count/size form wins where both could apply.
create or replace function private.purchase_line_pack_pattern()
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select '\y([0-9]+(?:\.[0-9]+)?)[ ]*[/x][ ]*([0-9]+(?:\.[0-9]+)?)[ ]*('
    || private.purchase_line_pack_units() || ')\y'
    || '|\y([0-9]+(?:\.[0-9]+)?)[ ]*(' || private.purchase_line_pack_units() || ')\y';
$$;

-- `1.50` -> `1.5`, `1.00` -> `1`. Rendering must not vary by input spelling.
create or replace function private.purchase_line_trim_number(p_value text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select pg_catalog.regexp_replace(
    pg_catalog.regexp_replace(p_value, '(\.[0-9]*[1-9])0+$', '\1'),
    '\.0+$',
    ''
  );
$$;

-- MISE-005A. Accent folding runs before any case change or character-class
-- test, so nothing downstream depends on LC_CTYPE. unaccent() is deliberately
-- not used: it is dictionary-backed and therefore not immutable.
-- translate() is strictly one-to-one, so the 9 characters that widen are
-- expanded by replace() first. Coverage is every letter in the Latin-1
-- Supplement and Latin Extended-A, plus NBSP folded to a plain space.
-- Any character outside this map is left alone here and then removed
-- deterministically by the ASCII-only class tests below.
create or replace function private.fold_purchase_line_accents(p_value text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select pg_catalog.translate(
    pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(p_value, 'Æ', 'AE'), 'Þ', 'TH'), 'ß', 'ss'), 'æ', 'ae'), 'þ', 'th'), 'Ĳ', 'IJ'), 'ĳ', 'ij'), 'Œ', 'OE'), 'œ', 'oe'),
    'ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝàáâãäåçèéêëìíîïðñòóôõöøùúûüýÿĀāĂăĄąĆćĈĉĊċČčĎďĐđĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĦħĨĩĪīĬĭĮįİıĴĵĶķĸĹĺĻļĽľĿŀŁłŃńŅņŇňŉŊŋŌōŎŏŐőŔŕŖŗŘřŚśŜŝŞşŠšŢţŤťŦŧŨũŪūŬŭŮůŰűŲųŴŵŶŷŸŹźŻżŽžſ ',
    'AAAAAACEEEEIIIIDNOOOOOOUUUUYaaaaaaceeeeiiiidnoooooouuuuyyAaAaAaCcCcCcCcDdDdEeEeEeEeEeGgGgGgGgHhHhIiIiIiIiIiJjKkkLlLlLlLlLlNnNnNnnNnOoOoOoRrRrRrSsSsSsSsTtTtTtUuUuUuUuUuUuWwYyYZzZzZzs '
  );
$$;

revoke all on function private.fold_purchase_line_accents(text)
from public, anon, authenticated, service_role;

-- Step 1 of normalization: fold accents, lowercase, collapse whitespace, trim.
-- Every case change and class test is pinned to COLLATE "C", so the result is
-- the same under any database LC_CTYPE. Punctuation survives this step so
-- pack/size structure such as `6/1gal` is still readable.
create or replace function private.fold_purchase_line_description(p_value text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select pg_catalog.btrim(
    pg_catalog.regexp_replace(
      pg_catalog.lower(private.fold_purchase_line_accents(p_value) collate "C") collate "C",
      '[[:space:]]+', ' ', 'g'
    )
  );
$$;

create or replace function private.extract_purchase_pack_size(p_description text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when captured.groups[1] is not null then
      private.purchase_line_trim_number(captured.groups[1]) || 'x'
        || private.purchase_line_trim_number(captured.groups[2]) || captured.groups[3]
    when captured.groups[4] is not null then
      private.purchase_line_trim_number(captured.groups[4]) || captured.groups[5]
  end
  from (
    select pg_catalog.regexp_match(
      private.fold_purchase_line_description(p_description) collate "C",
      private.purchase_line_pack_pattern()
    ) as groups
  ) captured;
$$;

-- Step 2 and 3: lift every pack/size token out, then strip punctuation from
-- what remains. No stemming, no synonyms, no fuzzy matching. Two spellings a
-- human would call the same item stay distinct. Null when nothing survives.
-- Pinned to COLLATE "C" so [[:alnum:]] means ASCII alphanumerics under every
-- LC_CTYPE. An unmapped non-ASCII character is therefore always treated as a
-- separator, identically on every cluster, rather than as a letter on one and
-- punctuation on another.
create or replace function private.normalize_purchase_item_key(p_description text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select nullif(
    pg_catalog.btrim(
      pg_catalog.regexp_replace(
        pg_catalog.regexp_replace(
          pg_catalog.regexp_replace(
            private.fold_purchase_line_description(p_description) collate "C",
            private.purchase_line_pack_pattern(),
            ' ',
            'g'
          ) collate "C",
          '[^[:alnum:]]+',
          ' ',
          'g'
        ) collate "C",
        '[[:space:]]+',
        ' ',
        'g'
      )
    ),
    ''
  );
$$;

revoke all on function private.purchase_line_pack_units()
from public, anon, authenticated, service_role;
revoke all on function private.purchase_line_pack_pattern()
from public, anon, authenticated, service_role;
revoke all on function private.purchase_line_trim_number(text)
from public, anon, authenticated, service_role;
revoke all on function private.fold_purchase_line_description(text)
from public, anon, authenticated, service_role;
revoke all on function private.extract_purchase_pack_size(text)
from public, anon, authenticated, service_role;
revoke all on function private.normalize_purchase_item_key(text)
from public, anon, authenticated, service_role;

-- Internal-consistency properties. A line that violates one of these is still
-- recorded exactly as the document stated it; only its confidence is capped.
-- Nothing is rejected, corrected, or rewritten.
--
-- Only mass and volume can genuinely contradict each other. Counting words
-- (each, ct, dozen) and container words (case, box, pack) count packages and
-- assert nothing about what is inside them, so they are absent here and can
-- never produce a conflict.
create or replace function private.purchase_line_unit_dimension(p_unit text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select dimensions.dimension
  from (values
    ('g','mass'),('gram','mass'),('grams','mass'),('kg','mass'),('kgs','mass'),
    ('mg','mass'),('mgs','mass'),('lb','mass'),('lbs','mass'),('oz','mass'),('ozs','mass'),
    ('ml','volume'),('l','volume'),('lt','volume'),('ltr','volume'),
    ('liter','volume'),('liters','volume'),('litre','volume'),('litres','volume'),
    ('gal','volume'),('gals','volume'),('gallon','volume'),('gallons','volume'),
    ('qt','volume'),('qts','volume'),('quart','volume'),('quarts','volume'),
    ('pt','volume'),('pts','volume'),('pint','volume'),('pints','volume')
  ) as dimensions(unit, dimension)
  where dimensions.unit = pg_catalog.btrim(pg_catalog.lower(p_unit));
$$;

create or replace function private.purchase_line_pack_unit(p_pack_size text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select (pg_catalog.regexp_match(pg_catalog.lower(p_pack_size), '([a-z]+)$'))[1];
$$;

-- Tolerance is derived from rounding, not picked: a unit price printed to the
-- cent is only known to within half a cent, so the extended price may drift by
-- quantity * 0.005, plus a cent for its own rounding.
create or replace function private.purchase_line_consistency_flags(
  p_quantity numeric,
  p_unit_of_measure text,
  p_pack_size text,
  p_unit_price numeric,
  p_extended_price numeric,
  p_transaction_date date,
  p_received_date date,
  p_stated_pack_size text,
  p_described_pack_size text
)
returns text[]
language sql
immutable
security invoker
set search_path = ''
as $$
  select array(
    select candidate.flag
    from pg_catalog.unnest(array[
      case
        when p_quantity is not null and p_unit_price is not null
          and p_extended_price is not null
          and pg_catalog.abs(p_quantity * p_unit_price - p_extended_price)
              > 0.01 + p_quantity * 0.005
        then 'extended_price_mismatch'
      end,
      case
        when private.purchase_line_unit_dimension(p_unit_of_measure) is not null
          and private.purchase_line_unit_dimension(
            private.purchase_line_pack_unit(p_pack_size)) is not null
          and private.purchase_line_unit_dimension(p_unit_of_measure)
            <> private.purchase_line_unit_dimension(
              private.purchase_line_pack_unit(p_pack_size))
        then 'pack_unit_dimension_conflict'
      end,
      case
        when p_received_date is not null and p_transaction_date is not null
          and p_received_date < p_transaction_date
        then 'received_before_transaction'
      end,
      case
        when p_stated_pack_size is not null and p_described_pack_size is not null
          and private.extract_purchase_pack_size(p_stated_pack_size) is not null
          and private.extract_purchase_pack_size(p_stated_pack_size)
            <> p_described_pack_size
        then 'pack_size_conflicts_description'
      end
    ]::text[]) as candidate(flag)
    where candidate.flag is not null
  );
$$;

create or replace function private.purchase_line_flag_label(p_flag text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case p_flag
    when 'extended_price_mismatch'
      then 'with an extended price that does not match quantity times unit price'
    when 'pack_unit_dimension_conflict'
      then 'where the pack size and the unit of measure disagree'
    when 'received_before_transaction'
      then 'received before the transaction date'
    when 'pack_size_conflicts_description'
      then 'with a stated pack size the description does not support'
  end;
$$;

create or replace function private.purchase_line_confidence_rank(p_confidence text)
returns integer
language sql
immutable
security invoker
set search_path = ''
as $$
  select case p_confidence when 'confirmed' then 2 when 'estimated' then 1 else 0 end;
$$;

-- An arithmetic or unit contradiction means we cannot say what was bought or
-- for how much, so the line cannot be verified at all. A date or pack-wording
-- disagreement leaves the money readable, so the line drops to an estimate.
create or replace function private.purchase_line_consistency_ceiling(p_flags text[])
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when p_flags && array['extended_price_mismatch', 'pack_unit_dimension_conflict']::text[]
      then 'could_not_verify'
    when pg_catalog.cardinality(p_flags) > 0 then 'estimated'
    else 'confirmed'
  end;
$$;

revoke all on function private.purchase_line_unit_dimension(text)
from public, anon, authenticated, service_role;
revoke all on function private.purchase_line_pack_unit(text)
from public, anon, authenticated, service_role;
revoke all on function private.purchase_line_consistency_flags(
  numeric, text, text, numeric, numeric, date, date, text, text
) from public, anon, authenticated, service_role;
revoke all on function private.purchase_line_flag_label(text)
from public, anon, authenticated, service_role;
revoke all on function private.purchase_line_confidence_rank(text)
from public, anon, authenticated, service_role;
revoke all on function private.purchase_line_consistency_ceiling(text[])
from public, anon, authenticated, service_role;

create table if not exists public.purchase_lines (
  id uuid primary key default gen_random_uuid(),
  sequence bigint generated by default as identity unique,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  supplier_id uuid,
  -- Idempotency must hold for documents from a supplier Mise cannot yet name.
  -- A null supplier collapses to the nil UUID, which gen_random_uuid() never
  -- produces, so unnamed-supplier documents still deduplicate.
  supplier_scope uuid generated always as (
    coalesce(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) stored,
  source text not null check (
    source in ('invoice', 'order_confirmation', 'manual_entry', 'credit_memo')
  ),
  -- Direction is stated, never inferred from a sign. Magnitudes below stay
  -- non-negative so a flipped sign remains a parse error rather than becoming
  -- a plausible credit, and so the arithmetic consistency rule needs no sign
  -- convention to reason about. Nullable only until the backfill below.
  line_type text check (line_type in ('purchase', 'credit')),
  source_document_reference text not null check (
    pg_catalog.length(pg_catalog.btrim(source_document_reference)) between 1 and 200
    and source_document_reference !~ '[[:cntrl:]]'
  ),
  line_index integer not null check (line_index between 0 and 9999),
  revision integer not null default 0 check (revision between 0 and 999),
  raw_item_description text not null check (
    pg_catalog.length(pg_catalog.btrim(raw_item_description)) between 1 and 500
    and raw_item_description !~ '[[:cntrl:]]'
  ),
  normalized_item_key text check (
    normalized_item_key is null
    or pg_catalog.length(normalized_item_key) between 1 and 500
  ),
  normalization_version text not null default 'mise.purchase_line_normalization.v1'
    check (normalization_version = 'mise.purchase_line_normalization.v1'),
  quantity numeric check (
    quantity is null or (quantity >= 0 and quantity <= 1000000000)
  ),
  unit_of_measure text check (
    unit_of_measure is null
    or (
      pg_catalog.length(pg_catalog.btrim(unit_of_measure)) between 1 and 80
      and unit_of_measure !~ '[[:cntrl:]]'
    )
  ),
  pack_size text check (
    pack_size is null
    or (
      pg_catalog.length(pg_catalog.btrim(pack_size)) between 1 and 80
      and pack_size !~ '[[:cntrl:]]'
    )
  ),
  unit_price numeric check (
    unit_price is null or (unit_price >= 0 and unit_price <= 1000000000)
  ),
  extended_price numeric check (
    extended_price is null or (extended_price >= 0 and extended_price <= 1000000000000)
  ),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  transaction_date date not null,
  received_date date,
  correlation_id uuid not null,
  parse_confidence text not null check (
    parse_confidence in ('confirmed', 'estimated', 'could_not_verify')
  ),
  consistency_flags text[] not null default array[]::text[],
  signed_quantity numeric generated always as (
    case when line_type = 'credit' then -quantity else quantity end
  ) stored,
  signed_extended_price numeric generated always as (
    case when line_type = 'credit' then -extended_price else extended_price end
  ) stored,
  supersedes_line_id uuid,
  -- A correction says the record was wrong. A credit says the record was right
  -- and money came back, so the original stays current and is never superseded.
  -- Set only when the source document itself names the original invoice line;
  -- Mise never infers the link. Several partial credits may reference one line,
  -- so unlike supersession this carries no uniqueness.
  credits_line_id uuid,
  evidence_version text not null default 'mise.purchase_line.v1'
    check (evidence_version = 'mise.purchase_line.v1'),
  recorded_by uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now(),
  constraint purchase_lines_restaurant_id_id_key unique (restaurant_id, id),
  -- The MISE-004C ingestion key. Ingestion always writes revision 0, so
  -- re-ingesting a document cannot duplicate its lines; corrections take
  -- higher revisions of the same document position.
  constraint purchase_lines_document_line_key unique (
    restaurant_id, supplier_scope, source_document_reference, line_index, revision
  ),
  constraint purchase_lines_supplier_fkey foreign key (restaurant_id, supplier_id)
    references public.suppliers (restaurant_id, id) on delete no action,
  constraint purchase_lines_supersedes_fkey foreign key (restaurant_id, supersedes_line_id)
    references public.purchase_lines (restaurant_id, id),
  constraint purchase_lines_self_supersede_check check (
    supersedes_line_id is null or supersedes_line_id <> id
  ),
  constraint purchase_lines_credits_fkey foreign key (restaurant_id, credits_line_id)
    references public.purchase_lines (restaurant_id, id),
  constraint purchase_lines_self_credit_check check (
    credits_line_id is null or credits_line_id <> id
  ),
  constraint purchase_lines_credit_link_check check (
    credits_line_id is null or line_type = 'credit'
  ),
  constraint purchase_lines_revision_supersedes_check check (
    (revision = 0 and supersedes_line_id is null)
    or (revision > 0 and supersedes_line_id is not null)
  ),
  constraint purchase_lines_price_currency_check check (
    currency is not null or (unit_price is null and extended_price is null)
  ),
  -- A line missing any parsed field it claims to carry cannot say it was
  -- verified. Nothing is defaulted to zero to make a line look complete.
  constraint purchase_lines_confidence_check check (
    parse_confidence = 'could_not_verify'
    or (
      quantity is not null
      and unit_of_measure is not null
      and unit_price is not null
      and extended_price is not null
      and normalized_item_key is not null
    )
  ),
  constraint purchase_lines_consistency_flags_check check (
    consistency_flags <@ array[
      'extended_price_mismatch', 'pack_unit_dimension_conflict',
      'received_before_transaction', 'pack_size_conflicts_description'
    ]::text[]
    and pg_catalog.cardinality(consistency_flags) <= 4
  ),
  -- A line cannot claim more confidence than its own internal evidence allows.
  constraint purchase_lines_consistency_confidence_check check (
    parse_confidence = 'could_not_verify'
    or (
      parse_confidence = 'estimated'
      and not (
        consistency_flags
          && array['extended_price_mismatch', 'pack_unit_dimension_conflict']::text[]
      )
    )
    or (
      parse_confidence = 'confirmed'
      and pg_catalog.cardinality(consistency_flags) = 0
    )
  ),
  constraint purchase_lines_normalized_key_check check (
    normalized_item_key
      is not distinct from private.normalize_purchase_item_key(raw_item_description)
  )
);

create index if not exists purchase_lines_item_history_idx
on public.purchase_lines (restaurant_id, normalized_item_key, transaction_date desc);
create index if not exists purchase_lines_supplier_idx
on public.purchase_lines (restaurant_id, supplier_id, transaction_date desc);
create index if not exists purchase_lines_document_idx
on public.purchase_lines (restaurant_id, source_document_reference, line_index);
create index if not exists purchase_lines_correlation_idx
on public.purchase_lines (restaurant_id, correlation_id);
-- Netting groups inside one supplier, key, unit and currency; never across them.
create index if not exists purchase_lines_net_idx
on public.purchase_lines (
  restaurant_id, supplier_scope, normalized_item_key, unit_of_measure, currency
);
create index if not exists purchase_lines_credits_idx
on public.purchase_lines (restaurant_id, credits_line_id)
where credits_line_id is not null;
-- A historical line may be corrected once; a correction chain is linear.
create unique index if not exists purchase_lines_supersedes_once_idx
on public.purchase_lines (restaurant_id, supersedes_line_id)
where supersedes_line_id is not null;

comment on table public.purchase_lines is
  'MISE-004C append-only purchase history. Corrections append a superseding line; historical lines are never mutated or deleted.';
comment on column public.purchase_lines.raw_item_description is
  'The description exactly as it appeared on the source document. Never rewritten.';
comment on column public.purchase_lines.normalized_item_key is
  'Deterministic grouping key. Not identity, not a match across suppliers, and not evidence of sameness.';
comment on column public.purchase_lines.parse_confidence is
  'Truthfulness of the parsed fields on this line. could_not_verify means a field was absent, never that it was defaulted.';

alter table public.purchase_lines enable row level security;

drop policy if exists "Members can read purchase lines" on public.purchase_lines;
create policy "Members can read purchase lines"
on public.purchase_lines for select to authenticated
using (private.is_restaurant_member(restaurant_id));

revoke all on table public.purchase_lines from public, anon, authenticated, service_role;
grant select on public.purchase_lines to authenticated;
grant select, insert on table public.purchase_lines to service_role;
revoke all on sequence public.purchase_lines_sequence_seq
from public, anon, authenticated;

-- Direction is backfilled explicitly rather than defaulted, so no writer can
-- omit it afterwards. This runs before the append-only trigger is installed;
-- once that trigger exists no update to this table is possible at all.
update public.purchase_lines set line_type = 'purchase' where line_type is null;
alter table public.purchase_lines alter column line_type set not null;

comment on column public.purchase_lines.line_type is
  'Direction of the line. Magnitudes stay non-negative; a credit is never a negative quantity.';
comment on column public.purchase_lines.credits_line_id is
  'The purchase line this credit offsets, only when the source document names it. Never inferred, and never required.';

-- Append-only. The two exceptions mirror the inventory and purchase-decision
-- ledgers: a parent restaurant DELETE cascading tenant history away, and the
-- account-deletion path anonymizing an actor who no longer exists.
-- Postgres does not populate STORED generated columns in the NEW record of a
-- BEFORE trigger, so comparing whole rows makes every generated column look
-- changed. Drop them from both sides, read out of the catalog rather than
-- named here, so adding or removing a generated column cannot silently
-- re-break an escape that depends on this comparison.
create or replace function private.purchase_line_without_generated(
  p_row jsonb,
  p_relid oid
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select p_row - (
    select coalesce(pg_catalog.array_agg(attribute.attname::text), array[]::text[])
    from pg_catalog.pg_attribute attribute
    where attribute.attrelid = p_relid
      and attribute.attnum > 0
      and not attribute.attisdropped
      and attribute.attgenerated <> ''
  );
$$;

revoke all on function private.purchase_line_without_generated(jsonb, oid)
from public, anon, authenticated, service_role;

create or replace function private.reject_purchase_line_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Escape 1: a parent restaurant DELETE cascading tenant history away. OLD is
  -- fully populated in a BEFORE DELETE trigger, generated columns included, and
  -- this branch compares no columns at all, so it carries no generated-column
  -- exposure. The tenant-cascade assertions prove that rather than assume it.
  if tg_op = 'DELETE'
    and pg_catalog.current_setting('mise.inventory_event_tenant_delete', true) = 'true'
  then
    return old;
  end if;

  -- Escape 2: account deletion anonymizing an actor who no longer exists.
  -- Every other column must be byte-identical. Excluding generated columns is
  -- safe because each one derives from columns this comparison still covers.
  if tg_op = 'UPDATE'
    and old.recorded_by is not null
    and new.recorded_by is null
    and not exists (
      select 1 from auth.users auth_user where auth_user.id = old.recorded_by
    )
    and (
      private.purchase_line_without_generated(pg_catalog.to_jsonb(new), tg_relid)
        - 'recorded_by'
    ) is not distinct from (
      private.purchase_line_without_generated(pg_catalog.to_jsonb(old), tg_relid)
        - 'recorded_by'
    )
  then
    return new;
  end if;

  raise exception 'Purchase lines are append-only' using errcode = '55000';
end;
$$;

revoke all on function private.reject_purchase_line_mutation()
from public, anon, authenticated, service_role;

drop trigger if exists reject_purchase_line_update_delete on public.purchase_lines;
create trigger reject_purchase_line_update_delete
before update or delete on public.purchase_lines
for each row execute function private.reject_purchase_line_mutation();

-- Additive activity vocabulary for the ledger. Existing values are unchanged.
alter table public.activity_events
  drop constraint if exists activity_events_event_type_check;
alter table public.activity_events
  add constraint activity_events_event_type_check check (event_type in (
    'forecast_updated', 'prep_plan_updated', 'inventory_risk_detected',
    'physical_count_requested', 'supplier_prices_checked', 'order_prepared',
    'order_approved', 'order_sent', 'supplier_confirmation_received',
    'delivery_expected', 'delivery_logged', 'invoice_discrepancy_detected',
    'waste_analysis_completed', 'staff_schedule_analyzed', 'staffing_gap_detected',
    'pos_sync_completed', 'reservation_forecast_updated',
    'customer_review_trend_detected', 'menu_item_performance_analyzed',
    'task_created', 'task_completed', 'task_reopened', 'task_unblocked',
    'automation_failed', 'approval_required', 'recommendation_created',
    'recommendation_dismissed', 'recommendation_outcome_measured',
    'restaurant_memory_updated', 'inventory_count_recorded',
    'purchase_lines_recorded', 'purchase_line_confidence_downgraded'
  ));

-- Confidence is only ever lowered here, never raised. The stated confidence,
-- what the document actually carried, and what the line's own numbers support
-- are three separate ceilings, and the lowest of them wins.
create or replace function private.resolve_purchase_line_confidence(
  p_requested text,
  p_quantity numeric,
  p_unit_of_measure text,
  p_unit_price numeric,
  p_extended_price numeric,
  p_normalized_item_key text,
  p_flags text[]
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
    )
  )
    when 2 then 'confirmed'
    when 1 then 'estimated'
    else 'could_not_verify'
  end;
$$;

revoke all on function private.resolve_purchase_line_confidence(
  text, numeric, text, numeric, numeric, text, text[]
) from public, anon, authenticated, service_role;

create or replace function private.purchase_line_text(p_line jsonb, p_key text, p_limit integer)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when pg_catalog.jsonb_typeof(p_line -> p_key) not in ('string') then null
    when pg_catalog.btrim(p_line ->> p_key) = '' then null
    when pg_catalog.length(pg_catalog.btrim(p_line ->> p_key)) > p_limit then null
    when pg_catalog.btrim(p_line ->> p_key) ~ '[[:cntrl:]]' then null
    else pg_catalog.btrim(p_line ->> p_key)
  end;
$$;

revoke all on function private.purchase_line_text(jsonb, text, integer)
from public, anon, authenticated, service_role;

create or replace function private.purchase_line_amount(p_line jsonb, p_key text, p_limit numeric)
returns numeric
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when pg_catalog.jsonb_typeof(p_line -> p_key) <> 'number' then null
    when (p_line ->> p_key)::numeric < 0 then null
    when (p_line ->> p_key)::numeric > p_limit then null
    else (p_line ->> p_key)::numeric
  end;
$$;

revoke all on function private.purchase_line_amount(jsonb, text, numeric)
from public, anon, authenticated, service_role;

-- One private writer for both ingestion and correction so the deterministic
-- normalization and confidence rules cannot diverge between the two paths.
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
  line_row public.purchase_lines%rowtype;
begin
  if pg_catalog.jsonb_typeof(p_line) <> 'object' then
    raise exception 'Each purchase line must be an object' using errcode = '22023';
  end if;

  -- Direction is stated by the caller or inherited from the line being
  -- corrected. It is never assumed.
  resolved_line_type := coalesce(
    p_line_type, private.purchase_line_text(p_line, 'lineType', 20));
  if resolved_line_type is null or resolved_line_type not in ('purchase', 'credit') then
    raise exception 'Purchase line % must state whether it is a purchase or a credit', p_line_index
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
    -- A stated link must resolve inside this tenant and this supplier. An
    -- unresolvable link fails closed rather than being dropped, because a
    -- credit with no link at all is recordable and says something different.
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
  unit_of_measure := private.purchase_line_text(p_line, 'unitOfMeasure', 80);
  -- The document's own pack wording is kept; a disagreement with the
  -- description becomes a flag rather than a silent correction.
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

  consistency_flags := private.purchase_line_consistency_flags(
    quantity, unit_of_measure, pack_size, unit_price, extended_price,
    transaction_date, received_date, stated_pack_size, described_pack_size
  );

  insert into public.purchase_lines (
    restaurant_id, supplier_id, source, source_document_reference, line_index,
    revision, raw_item_description, normalized_item_key, quantity,
    unit_of_measure, pack_size, unit_price, extended_price, currency,
    transaction_date, received_date, correlation_id, parse_confidence,
    consistency_flags, line_type, credits_line_id, supersedes_line_id, recorded_by
  ) values (
    p_restaurant_id, p_supplier_id, p_source, p_source_document_reference,
    p_line_index, p_revision, raw_description, normalized_key, quantity,
    unit_of_measure, pack_size, unit_price, extended_price, currency,
    transaction_date, received_date, p_correlation_id,
    private.resolve_purchase_line_confidence(
      requested_confidence, quantity, unit_of_measure, unit_price,
      extended_price, normalized_key, consistency_flags
    ),
    consistency_flags, resolved_line_type, credited_line_id,
    p_supersedes_line_id, auth.uid()
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

-- A downgrade is never silent. This names every property that failed, how many
-- lines each one affected, and which document positions they were.
create or replace function private.append_purchase_line_downgrade_activity(
  p_restaurant_id uuid,
  p_document_reference text,
  p_correlation_id uuid,
  p_recorded_line_count integer,
  p_flags text[],
  p_details jsonb,
  p_occurred_at timestamptz
)
returns public.activity_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  flag_summary text;
  downgraded_line_count integer := pg_catalog.jsonb_array_length(p_details);
begin
  select pg_catalog.string_agg(tally.line, '; ' order by tally.flag)
  into flag_summary
  from (
    select occurrence.flag,
      pg_catalog.count(*)::text || ' ' || private.purchase_line_flag_label(occurrence.flag)
        as line
    from pg_catalog.unnest(p_flags) as occurrence(flag)
    group by occurrence.flag
  ) tally;

  return private.append_activity_event(
    p_restaurant_id,
    'purchase_line_confidence_downgraded',
    'orders',
    'Purchase line confidence lowered',
    pg_catalog.format(
      '%s of %s recorded lines from %s could not keep their stated confidence: %s.',
      downgraded_line_count, p_recorded_line_count, p_document_reference, flag_summary
    ),
    p_occurred_at,
    'mise.purchase_line_ledger',
    'user',
    auth.uid(),
    'purchase_line_confidence_downgrade',
    p_document_reference,
    '[]'::jsonb,
    array['mise']::text[],
    null::uuid,
    null::uuid,
    1::smallint,
    null::numeric,
    'completed',
    true,
    null::timestamptz,
    'purchase_document',
    p_document_reference,
    null::text,
    p_correlation_id,
    null::uuid,
    'purchase_line_confidence_downgrade:' || p_correlation_id::text,
    pg_catalog.jsonb_build_object(
      'downgradedLineCount', downgraded_line_count,
      'recordedLineCount', p_recorded_line_count,
      'lines', p_details
    )
  );
end;
$$;

revoke all on function private.append_purchase_line_downgrade_activity(
  uuid, text, uuid, integer, text[], jsonb, timestamptz
) from public, anon, authenticated, service_role;

-- Server-authoritative ingestion. Re-ingesting a document records nothing new
-- and still reports what it found, so a duplicate submission is visible rather
-- than silent.
create or replace function public.ingest_purchase_lines(
  p_restaurant_id uuid,
  p_source text,
  p_source_document_reference text,
  p_lines jsonb,
  p_supplier_id uuid default null,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  document_reference text;
  correlation uuid;
  entry jsonb;
  line_index integer;
  seen_indexes integer[] := array[]::integer[];
  line_row public.purchase_lines%rowtype;
  submitted integer := 0;
  recorded integer := 0;
  duplicates integer := 0;
  confirmed integer := 0;
  estimated integer := 0;
  unverified integer := 0;
  activity public.activity_events%rowtype;
  requested_confidence text;
  downgrade_flags text[] := array[]::text[];
  downgrade_details jsonb := '[]'::jsonb;
  occurred_at timestamptz := pg_catalog.clock_timestamp();
begin
  if auth.uid() is null
    or not private.has_restaurant_role(
      p_restaurant_id, array['owner', 'admin', 'manager']::text[]
    )
  then
    raise exception 'Manager access required' using errcode = '42501';
  end if;
  if p_source not in ('invoice', 'order_confirmation', 'manual_entry', 'credit_memo') then
    raise exception 'Unsupported purchase line source' using errcode = '22023';
  end if;

  document_reference := nullif(pg_catalog.btrim(p_source_document_reference), '');
  if document_reference is null
    or pg_catalog.length(document_reference) > 200
    or document_reference ~ '[[:cntrl:]]'
  then
    raise exception 'A source document reference is required' using errcode = '22023';
  end if;

  -- Supplier identity is MISE-003C durable identity or nothing. A supplier from
  -- another restaurant fails closed rather than silently becoming unattributed.
  if p_supplier_id is not null
    and not exists (
      select 1 from public.suppliers supplier
      where supplier.restaurant_id = p_restaurant_id
        and supplier.id = p_supplier_id
    )
  then
    raise exception 'Supplier identity is not available for this restaurant'
      using errcode = '42501';
  end if;

  if pg_catalog.jsonb_typeof(p_lines) <> 'array'
    or pg_catalog.jsonb_array_length(p_lines) not between 1 and 500
  then
    raise exception 'Between 1 and 500 purchase lines are required' using errcode = '22023';
  end if;

  correlation := coalesce(p_correlation_id, pg_catalog.gen_random_uuid());

  for entry in select value from pg_catalog.jsonb_array_elements(p_lines) loop
    submitted := submitted + 1;
    if pg_catalog.jsonb_typeof(entry -> 'lineIndex') <> 'number' then
      raise exception 'Every purchase line needs its document position' using errcode = '22023';
    end if;
    line_index := (entry ->> 'lineIndex')::integer;
    -- Two lines claiming one document position would silently collapse under
    -- the idempotency key, so the whole submission fails instead.
    if line_index = any (seen_indexes) then
      raise exception 'Purchase line position % was submitted twice', line_index
        using errcode = '22023';
    end if;
    seen_indexes := seen_indexes || line_index;

    requested_confidence := private.purchase_line_text(entry, 'parseConfidence', 40);
    line_row := private.append_purchase_line(
      p_restaurant_id, p_supplier_id, p_source, document_reference, correlation,
      entry, line_index, 0, null, true
    );
    if line_row.id is null then
      duplicates := duplicates + 1;
    else
      recorded := recorded + 1;
      confirmed := confirmed + (line_row.parse_confidence = 'confirmed')::integer;
      estimated := estimated + (line_row.parse_confidence = 'estimated')::integer;
      unverified := unverified + (line_row.parse_confidence = 'could_not_verify')::integer;
      -- Only an internal-consistency downgrade is reported here. A line that
      -- lost confidence purely because a field was absent is already counted
      -- in the could-not-verify total on the ingestion record.
      if pg_catalog.cardinality(line_row.consistency_flags) > 0
        and private.purchase_line_confidence_rank(requested_confidence)
            > private.purchase_line_confidence_rank(line_row.parse_confidence)
      then
        downgrade_flags := downgrade_flags || line_row.consistency_flags;
        if pg_catalog.jsonb_array_length(downgrade_details) < 50 then
          downgrade_details := downgrade_details || pg_catalog.jsonb_build_array(
            pg_catalog.jsonb_build_object(
              'lineIndex', line_index,
              'statedConfidence', requested_confidence,
              'recordedConfidence', line_row.parse_confidence,
              'failedProperties', pg_catalog.to_jsonb(line_row.consistency_flags)
            )
          );
        end if;
      end if;
    end if;
  end loop;

  activity := private.append_activity_event(
    p_restaurant_id,
    'purchase_lines_recorded',
    'orders',
    'Purchase lines recorded',
    pg_catalog.format(
      'Recorded %s of %s lines from %s. %s already on file. %s confirmed, %s estimated, %s could not be verified.',
      recorded, submitted, document_reference, duplicates, confirmed, estimated, unverified
    ),
    occurred_at,
    'mise.purchase_line_ledger',
    'user',
    auth.uid(),
    'purchase_line_ingestion',
    document_reference,
    '[]'::jsonb,
    array['mise']::text[],
    null::uuid,
    null::uuid,
    1::smallint,
    null::numeric,
    'completed',
    unverified > 0,
    null::timestamptz,
    'purchase_document',
    document_reference,
    null::text,
    correlation,
    null::uuid,
    'purchase_line_ingestion:' || correlation::text,
    pg_catalog.jsonb_build_object(
      'source', p_source,
      'supplierId', p_supplier_id,
      'submittedLineCount', submitted,
      'recordedLineCount', recorded,
      'duplicateLineCount', duplicates,
      'confirmedCount', confirmed,
      'estimatedCount', estimated,
      'couldNotVerifyCount', unverified
    )
  );

  if pg_catalog.jsonb_array_length(downgrade_details) > 0 then
    perform private.append_purchase_line_downgrade_activity(
      p_restaurant_id, document_reference, correlation, recorded,
      downgrade_flags, downgrade_details, occurred_at
    );
  end if;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata, created_at
  ) values (
    p_restaurant_id, auth.uid(), 'purchase_lines_ingested', 'purchase_lines', null,
    pg_catalog.jsonb_build_object(
      'correlation_id', correlation,
      'source', p_source,
      'source_document_reference', document_reference,
      'supplier_id', p_supplier_id,
      'recorded_line_count', recorded,
      'duplicate_line_count', duplicates,
      'could_not_verify_count', unverified,
      'consistency_downgrade_count', pg_catalog.jsonb_array_length(downgrade_details)
    ),
    occurred_at
  );

  return pg_catalog.jsonb_build_object(
    'correlationId', correlation,
    'sourceDocumentReference', document_reference,
    'supplierId', p_supplier_id,
    'submittedLineCount', submitted,
    'recordedLineCount', recorded,
    'duplicateLineCount', duplicates,
    'confirmedCount', confirmed,
    'estimatedCount', estimated,
    'couldNotVerifyCount', unverified,
    'consistencyDowngradeCount', pg_catalog.jsonb_array_length(downgrade_details),
    'activityEventId', activity.id
  );
end;
$$;

revoke all on function public.ingest_purchase_lines(uuid, text, text, jsonb, uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.ingest_purchase_lines(uuid, text, text, jsonb, uuid, uuid)
to authenticated;

comment on function public.ingest_purchase_lines(uuid, text, text, jsonb, uuid, uuid) is
  'Records purchase history idempotently on (restaurant, supplier, document, line). It never predicts, orders, or matches items.';

-- A correction is a new line, never an edit. The corrected line keeps its
-- document position so re-ingesting the original document stays idempotent.
create or replace function public.supersede_purchase_line(
  p_restaurant_id uuid,
  p_line_id uuid,
  p_line jsonb,
  p_correlation_id uuid default null
)
returns public.purchase_lines
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.purchase_lines%rowtype;
  correction public.purchase_lines%rowtype;
  correlation uuid;
  requested_confidence text;
  occurred_at timestamptz := pg_catalog.clock_timestamp();
begin
  if auth.uid() is null
    or not private.has_restaurant_role(
      p_restaurant_id, array['owner', 'admin', 'manager']::text[]
    )
  then
    raise exception 'Manager access required' using errcode = '42501';
  end if;

  select * into target
  from public.purchase_lines line
  where line.restaurant_id = p_restaurant_id
    and line.id = p_line_id
  for share;
  if not found then
    raise exception 'Purchase line not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.purchase_lines successor
    where successor.restaurant_id = p_restaurant_id
      and successor.supersedes_line_id = target.id
  ) then
    raise exception 'Purchase line has already been corrected' using errcode = '23505';
  end if;

  correlation := coalesce(p_correlation_id, pg_catalog.gen_random_uuid());
  requested_confidence := private.purchase_line_text(p_line, 'parseConfidence', 40);
  correction := private.append_purchase_line(
    p_restaurant_id, target.supplier_id, 'manual_entry',
    target.source_document_reference, correlation, p_line, target.line_index,
    target.revision + 1, target.id, false, target.line_type
  );

  perform private.append_activity_event(
    p_restaurant_id,
    'purchase_lines_recorded',
    'orders',
    'Purchase line corrected',
    pg_catalog.format(
      'Line %s of %s was corrected. The original line is unchanged and remains on file.',
      target.line_index, target.source_document_reference
    ),
    occurred_at,
    'mise.purchase_line_ledger',
    'user',
    auth.uid(),
    'purchase_line_correction',
    target.source_document_reference,
    '[]'::jsonb,
    array['mise']::text[],
    null::uuid,
    null::uuid,
    1::smallint,
    null::numeric,
    'completed',
    correction.parse_confidence = 'could_not_verify',
    null::timestamptz,
    'purchase_line',
    correction.id::text,
    null::text,
    correlation,
    null::uuid,
    'purchase_line_correction:' || correction.id::text,
    pg_catalog.jsonb_build_object(
      'supersededLineId', target.id,
      'revision', correction.revision,
      'parseConfidence', correction.parse_confidence
    )
  );

  if pg_catalog.cardinality(correction.consistency_flags) > 0
    and private.purchase_line_confidence_rank(requested_confidence)
        > private.purchase_line_confidence_rank(correction.parse_confidence)
  then
    perform private.append_purchase_line_downgrade_activity(
      p_restaurant_id, target.source_document_reference, correlation, 1,
      correction.consistency_flags,
      pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'lineIndex', target.line_index,
        'statedConfidence', requested_confidence,
        'recordedConfidence', correction.parse_confidence,
        'failedProperties', pg_catalog.to_jsonb(correction.consistency_flags)
      )),
      occurred_at
    );
  end if;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata, created_at
  ) values (
    p_restaurant_id, auth.uid(), 'purchase_line_superseded', 'purchase_lines',
    correction.id,
    pg_catalog.jsonb_build_object(
      'superseded_line_id', target.id,
      'revision', correction.revision,
      'correlation_id', correlation
    ),
    occurred_at
  );

  return correction;
end;
$$;

revoke all on function public.supersede_purchase_line(uuid, uuid, jsonb, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.supersede_purchase_line(uuid, uuid, jsonb, uuid)
to authenticated;

comment on function public.supersede_purchase_line(uuid, uuid, jsonb, uuid) is
  'Appends a correcting purchase line that supersedes a prior line by reference. It never mutates or deletes the original.';

-- Net quantity and spend per item, as a plain aggregate over the signed
-- projections. Superseded lines are excluded because a corrected line is no
-- longer what happened.
--
-- KNOWN LIMITATION. Netting groups by normalized_item_key, and that key is only
-- as stable as the wording each document used. A credit memo that describes an
-- item differently from the invoice forms its own group and will not net
-- against it. MISE-004C forbids fuzzy matching, stemming and clustering, so
-- this cannot be resolved here and is not papered over: a group holding credits
-- with no purchase behind it is returned with unmatched_credit set, so an
-- unnetted credit is visible as an unmatched credit rather than disappearing
-- into a silently wrong net. Grouping never crosses supplier, unit of measure
-- or currency, because netting across any of those would be a different and
-- larger claim than the documents support.
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
  'Factual net quantity and spend per item from recorded lines. Credits whose item key matches no purchase are flagged unmatched, never netted silently. It states what was recorded and nothing more.';

-- MISE-005AQ: purchase_decision_events.source_event_key CHECK must use
-- COLLATE "C" so dump/restore cannot accept an idempotency key the
-- restored ASCII C-locale gate would refuse.
begin;
select plan(8);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.purchase_decision_events'::regclass
      and conname = 'purchase_decision_events_source_event_key_check'
  ),
  'purchase_decision_events_source_event_key_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_decision_events'::regclass
      and conname = 'purchase_decision_events_source_event_key_check'
  ),
  'source_event_key collate "C" ~ ''\^\[A-Za-z0-9:_-\]\{8,200\}\$''',
  'purchase_decision_events source_event_key CHECK uses COLLATE C'
);

select is(
  (
    select pg_get_constraintdef(oid) not ilike '%length(source_event_key)%'
    from pg_constraint
    where conrelid = 'public.purchase_decision_events'::regclass
      and conname = 'purchase_decision_events_source_event_key_check'
  ),
  true,
  'purchase_decision_events source_event_key CHECK is not length-only'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('audit_log:550e8400-e29b-41d4-a716-446655440000' collate "C"
    ~ '^[A-Za-z0-9:_-]{8,200}$'),
  true,
  'audit_log UUID source_event_key matches under COLLATE C'
);

select is(
  ('purchase_decision_exclusion:550e8400-e29b-41d4-a716-446655440000'
    collate "C" ~ '^[A-Za-z0-9:_-]{8,200}$'),
  true,
  'exclusion UUID source_event_key matches under COLLATE C'
);

select is(
  ('aggregate-mixed-2' collate "C" ~ '^[A-Za-z0-9:_-]{8,200}$'),
  true,
  'hyphenated fixture source_event_key matches under COLLATE C'
);

select is(
  ('audit log key' collate "C" ~ '^[A-Za-z0-9:_-]{8,200}$'),
  false,
  'spaced source_event_key is rejected under COLLATE C'
);

select is(
  ('short' collate "C" ~ '^[A-Za-z0-9:_-]{8,200}$'),
  false,
  'too-short source_event_key is rejected under COLLATE C'
);

select * from finish();
rollback;

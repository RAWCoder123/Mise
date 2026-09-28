-- MISE-005BM: pos_integrations.sync_cursor CHECK must reject control
-- characters under COLLATE "C" while preserving the writer length 1–500 bound
-- and NULL (disconnected / cleared), so restore cannot accept cursor bytes a
-- restored C-locale gate would refuse (and vice versa).
begin;
select plan(8);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pos_integrations'::regclass
      and conname = 'pos_integrations_sync_cursor_check'
  ),
  'pos_integrations_sync_cursor_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_integrations'::regclass
      and conname = 'pos_integrations_sync_cursor_check'
  ),
  'sync_cursor is null',
  'pos_integrations.sync_cursor CHECK allows NULL'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_integrations'::regclass
      and conname = 'pos_integrations_sync_cursor_check'
  ),
  'sync_cursor collate "C" !~ ''[[:cntrl:]]''',
  'pos_integrations.sync_cursor CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_integrations'::regclass
      and conname = 'pos_integrations_sync_cursor_check'
  ),
  'length\(sync_cursor\) between 1 and 500',
  'pos_integrations.sync_cursor CHECK preserves length 1–500 bound'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  (E'cursor\tpage-2' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII tab is a control under COLLATE C'
);

select is(
  ('CAESEDabc123XYZ_cursor_token' collate "C" ~ '[[:cntrl:]]'),
  false,
  'printable ASCII sync cursor is not a control under COLLATE C'
);

select is(
  (E'cursor\u007fpage' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII DEL is a control under COLLATE C'
);

select is(
  (repeat('a', 500) collate "C" ~ '[[:cntrl:]]'),
  false,
  'max-length printable ASCII cursor is not a control under COLLATE C'
);

select * from finish();
rollback;

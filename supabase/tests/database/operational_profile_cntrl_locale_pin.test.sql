-- MISE-005HK: private.restaurant_operational_profile_is_valid must reject
-- ASCII controls under COLLATE "C" on single-line profile array entries,
-- compare serviceStyle under COLLATE "C", and reject unsafe controls on
-- notes while allowing LF/TAB/CR so dump/restore cannot accept profile
-- bytes the restored C-locale gate would refuse. Sibling restaurant name /
-- address / logo / currency tips stay on separate PRs.
begin;
select plan(16);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'private'::regnamespace
      and proname = 'restaurant_operational_profile_is_valid'
  ),
  'restaurant_operational_profile_is_valid exists'
);

select matches(
  pg_get_functiondef(
    'private.restaurant_operational_profile_is_valid(jsonb)'::regprocedure
  ),
  'array_text collate "C" ~ ''[[:cntrl:]]''',
  'profile array entries reject controls under COLLATE C'
);

select matches(
  pg_get_functiondef(
    'private.restaurant_operational_profile_is_valid(jsonb)'::regprocedure
  ),
  'style_text collate "C" not in',
  'serviceStyle allowlist stays pinned under COLLATE C'
);

select matches(
  pg_get_functiondef(
    'private.restaurant_operational_profile_is_valid(jsonb)'::regprocedure
  ),
  'notes_text collate "C" ~',
  'profile notes reject unsafe controls under COLLATE C'
);

select matches(
  pg_get_functiondef(
    'private.restaurant_operational_profile_is_valid(jsonb)'::regprocedure
  ),
  E'\\\\x00-\\\\x08\\\\x0B\\\\x0C\\\\x0E-\\\\x1F\\\\x7F',
  'profile notes use multiline-aware control class (allow LF/TAB/CR)'
);

select matches(
  pg_get_functiondef(
    'private.restaurant_operational_profile_is_valid(jsonb)'::regprocedure
  ),
  'quick_service.*fast_casual.*full_service.*bar.*cafe.*ghost_kitchen',
  'serviceStyle vocabulary remains the established allowlist'
);

select is(
  has_function_privilege(
    'service_role',
    'private.restaurant_operational_profile_is_valid(jsonb)',
    'EXECUTE'
  ),
  true,
  'service_role retains EXECUTE on the profile validator'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Mon/Wed delivery' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable profile array entry is accepted under COLLATE C'
);

select is(
  (E'Mon\tWed' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in profile array entry is rejected under COLLATE C'
);

select is(
  (E'Mon\nWed' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in profile array entry is rejected under COLLATE C'
);

select is(
  (E'count\u007fdrift' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in profile array entry is rejected under COLLATE C'
);

select is(
  (
    E'Prep before\ndinner service' collate "C"
      !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
  ),
  true,
  'multiline profile notes allow LF under COLLATE C'
);

select is(
  (
    E'Prep\tbefore dinner' collate "C"
      !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
  ),
  true,
  'multiline profile notes allow TAB under COLLATE C'
);

select is(
  (
    E'Prep\u0000before' collate "C"
      !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
  ),
  false,
  'NUL in profile notes is rejected under COLLATE C'
);

select is(
  private.restaurant_operational_profile_is_valid(
    jsonb_build_object(
      'serviceStyle', 'full_service',
      'orderCadence', jsonb_build_array('Mon/Wed delivery'),
      'prepWindows', jsonb_build_array('lunch mise'),
      'primarySuppliers', jsonb_build_array('Sysco'),
      'inventoryReviewDays', jsonb_build_array('Sunday'),
      'notes', E'Count high-risk proteins\nbefore dinner.'
    )
  ),
  true,
  'valid operational profile is accepted'
);

select is(
  private.restaurant_operational_profile_is_valid(
    jsonb_build_object(
      'serviceStyle', 'full_service',
      'orderCadence', jsonb_build_array(E'Mon\tWed delivery'),
      'prepWindows', jsonb_build_array('lunch mise'),
      'primarySuppliers', jsonb_build_array('Sysco'),
      'inventoryReviewDays', jsonb_build_array('Sunday'),
      'notes', 'ok'
    )
  ),
  false,
  'control-bearing profile array entry is rejected by the validator'
);

select * from finish();
rollback;

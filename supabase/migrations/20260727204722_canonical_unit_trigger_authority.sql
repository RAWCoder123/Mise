-- Trigger execution must not depend on Data API caller privileges. Keep both
-- functions private, search-path pinned, and uncallable by app roles while
-- allowing trusted inserts and the guarded event RPC to enforce canonical
-- authority consistently.

alter function private.normalize_inventory_item_canonical_unit()
  security definer;

alter function private.enforce_inventory_event_canonical_unit()
  security definer;

revoke all on function private.normalize_inventory_item_canonical_unit()
  from public, anon, authenticated, service_role;
revoke all on function private.enforce_inventory_event_canonical_unit()
  from public, anon, authenticated, service_role;

comment on function private.normalize_inventory_item_canonical_unit() is
  'Private trigger authority for canonical-unit normalization; app roles have no direct execute grant.';

comment on function private.enforce_inventory_event_canonical_unit() is
  'Private trigger authority that rejects events without a verified matching item unit.';

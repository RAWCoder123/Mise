-- MISE-005CF: pin public.inventory_events.event_type CHECK
-- to COLLATE "C", preserving the exact-token allowlist.
--
-- public.inventory_events stores ledger event vocabulary under a bare
-- IN allowlist from operational_data_foundation_inventory_ledger:
--   event_type in (
--     'receipt', 'count', 'waste', 'stockout',
--     'usage', 'adjustment', 'transfer', 'correction'
--   )
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'receipt'     — received stock / delivery putaway
--   'count'       — inventory count session apply
--   'waste'       — waste / spoilage record
--   'stockout'    — confirmed stockout (quantity zero)
--   'usage'       — explicit usage / prep consumption
--   'adjustment'  — manager quantity adjustment
--   'transfer'    — station / location transfer
--   'correction'  — superseding ledger correction
--
-- event_type is the durable ledger-event vocabulary that drives quantity
-- sign rules, correction supersession, activity emission, and POS depletion
-- attribution. POSIX character classes follow database LC_CTYPE. This
-- cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; open MISE-005BR (#478) pins inventory_events identity
-- (source / client_event_id / idempotency_key) and MISE-005CE (#491) pins
-- sibling canonical_unit, but both leave event_type on bare IN only.
--
-- If LC_CTYPE drifted under a bare-IN event_type CHECK, dump/restore could
-- accept ledger-vocabulary bytes the restored C-locale path (and sibling
-- machine-identity gates) would refuse — or the reverse — breaking inventory
-- event continuity across restore.
--
-- Scope:
--   - Replace inventory_events_event_type_check with
--     exact-token allowlist PLUS ASCII shape under COLLATE "C":
--       event_type in (
--         'receipt', 'count', 'waste', 'stockout',
--         'usage', 'adjustment', 'transfer', 'correction'
--       )
--       and event_type collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
-- Does NOT rewrite append_inventory_event / ledger writers,
-- inventory_event_quantity_check, inventory_event_supersedes_check,
-- inventory_events identity (#478), sibling canonical_unit (#491),
-- activity_events.event_type, or free-form metadata/notes.
-- Timestamp after MISE-005CE (#491).

alter table public.inventory_events
  drop constraint if exists inventory_events_event_type_check;

alter table public.inventory_events
  add constraint inventory_events_event_type_check check (
    event_type in (
      'receipt',
      'count',
      'waste',
      'stockout',
      'usage',
      'adjustment',
      'transfer',
      'correction'
    )
    and event_type collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint inventory_events_event_type_check
  on public.inventory_events is
  'MISE-005CF: exact receipt/count/waste/stockout/usage/adjustment/transfer/correction allowlist plus ASCII shape under COLLATE "C". Inventory ledger event vocabulary.';

comment on column public.inventory_events.event_type is
  'Ledger event vocabulary. Allowed values: receipt, count, waste, stockout, usage, adjustment, transfer, correction under COLLATE "C".';

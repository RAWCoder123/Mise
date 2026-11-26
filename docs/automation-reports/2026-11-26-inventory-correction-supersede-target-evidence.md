# Inventory correction supersede-target evidence (2026-11-26)

## Gap

Hosted `public.record_inventory_event` already requires `supersedes_event_id`
(when present) to resolve under the same `restaurant_id` and
`inventory_item_id`. Soft CHECKs on `origin/main` only require
`event_type = 'correction'` when a supersedes id is present, and the FK is a
bare `references inventory_events(id)`.

Direct inserts can therefore stamp a correction onto:

- a different inventory item inside the same restaurant; or
- an event that belongs to another restaurant.

Projection then applies the forged correction delta under the wrong item while
Activity / waste-repair analysis treat the foreign id as durable repair
evidence.

## Change

- Domain helper `validateInventoryCorrectionSupersedeTargetEvidence`
  (`supersede_target_*` codes).
- Additive BEFORE INSERT tip only (no CHECK — cross-row identity).
- pgTAP plan=10 proves cross-item / cross-restaurant direct rejects,
  same-item direct + RPC accepts, orphan corrections without supersedes remain
  accepted here, and second supersession stays fail-closed.

## Alone-OK

Orthogonal to:

- orphan-supersede requirement (#394);
- exact-reverse quantity (#395);
- correction note / reason / source tips (#1272–#1274);
- inventory source / actor / transfer tips (#1259–#1282);
- purchase-line supersede identity (#1290);
- product waste/receipt correction UIs (#345/#350).

Does not rewrite `record_inventory_event`.

## Verification

Baseline: `origin/main` @ `78da7376`

- `npm run typecheck` passed
- focused suite 9/9 passed
- `npm test` 685 passed / 0 fail / 7 cancelled (pre-existing withTimeout parent cancellations)
- `npm run security:static` / `security:backend` / `design:static` passed
- `npm run supabase:test` not run in this environment

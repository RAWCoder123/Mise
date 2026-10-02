# MISE-005FA restaurant_memories.correction cntrl locale pin

## Summary

CHECK-only locale pin for durable restaurant-memory corrections:

- Add `restaurant_memories_correction_check` — `correction is null` or `length(trim(correction)) between 1 and 1000` plus multiline-aware ASCII control rejection under COLLATE `"C"`:
  `correction collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'`
- Operator free-form text; allows LF/TAB/CR (same class as `unsafeSupplierSendMultilineControlPattern` / operator_note / activity_events.summary). Rejects other C0 controls and DEL.
- Aligns the table gate with the existing RPC truncate `left(trim(p_correction), 1000)` without rewriting `update_restaurant_memory`.
- Documents the correction→summary path that copies operator LF into `activity_events.summary`.

Does not rewrite `update_restaurant_memory`, statement (#563), source/dedupe_key bounds, memory vocabulary (#511), or activity_events.summary (#564).

## Verification

- `npm run typecheck` — passed
- focused `restaurantMemoriesCorrectionCntrlLocalePin` — 4/4
- `npm test` — 680 pass / 0 fail / 7 cancelled
- pgTAP plan **15** counted from 15 assertion call sites (Docker unavailable here)

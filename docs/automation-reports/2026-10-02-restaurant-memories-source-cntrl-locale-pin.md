# MISE-005FB restaurant_memories.source cntrl locale pin

Date: 2026-10-02
Branch: `cursor/mise-restaurant-memories-source-cntrl-locale-pin`
Base: `origin/main` @ `78da737`

## Change

- Additive migration `20261001320000_mise_005fb_restaurant_memories_source_cntrl_locale_pin.sql`
- Reattach `restaurant_memories_source_check`
- Preserve exact `length(trim(source)) between 1 and 120`
- Add ASCII control rejection under COLLATE `"C"`:
  `source collate "C" !~ '[[:cntrl:]]'`
- System source labels (e.g. `supplier_delivery_outcomes`) — full `[[:cntrl:]]`, not multiline allowlist

## Scope boundaries

CHECK-only SQL. Does not rewrite supplier-delivery / `update_restaurant_memory`
writers, statement (#563), correction (#565), dedupe_key, memory vocabulary
(#511), or `activity_events.source`.

## Verification

- `npm run typecheck` — passed
- focused `restaurantMemoriesSourceCntrlLocalePin` — 3/3
- `npm test` — 679 pass / 0 fail / 7 cancelled (withTimeout baseline)
- pgTAP plan **12** counted from 12 assertion call sites (Docker unavailable here)

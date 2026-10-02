# MISE-005FD activity_events.trigger_type cntrl locale pin

Date: 2026-10-02
Branch: `cursor/mise-activity-events-trigger-type-cntrl-locale-pin`
Base: `origin/main` @ `78da737`

## Change

- Additive migration `20261001340000_mise_005fd_activity_events_trigger_type_cntrl_locale_pin.sql`
- Reattach `activity_events_trigger_type_check`
- Preserve exact `length(trim(trigger_type)) between 1 and 120`
- Add ASCII control rejection under COLLATE `"C"`:
  `trigger_type collate "C" !~ '[[:cntrl:]]'`
- System trigger labels (e.g. `supplier_delivery_outcome`, `purchase_line_ingestion`) — full `[[:cntrl:]]`, not multiline allowlist

## Scope boundaries

CHECK-only SQL. Does not rewrite activity RPCs, title (#560), summary (#564),
source (#567), idempotency_key, or restaurant_memories.* tips.

## Verification

- `npm run typecheck` — passed
- focused `activityEventsTriggerTypeCntrlLocalePin` — 3/3
- `npm test` — 679 pass / 0 fail / 7 cancelled (withTimeout baseline)
- pgTAP plan **12** counted from 12 assertion call sites (Docker unavailable here)

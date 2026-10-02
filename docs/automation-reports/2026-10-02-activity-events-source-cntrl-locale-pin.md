# MISE-005FC activity_events.source cntrl locale pin

Date: 2026-10-02
Branch: `cursor/mise-activity-events-source-cntrl-locale-pin`
Base: `origin/main` @ `78da737`

## Change

- Additive migration `20261001330000_mise_005fc_activity_events_source_cntrl_locale_pin.sql`
- Reattach `activity_events_source_check`
- Preserve exact `length(trim(source)) between 1 and 80`
- Add ASCII control rejection under COLLATE `"C"`:
  `source collate "C" !~ '[[:cntrl:]]'`
- System source labels (e.g. `mise`, `inventory`, `pos`) — full `[[:cntrl:]]`, not multiline allowlist

## Scope boundaries

CHECK-only SQL. Does not rewrite activity RPCs, title (#560), summary (#564),
trigger_type, or restaurant_memories.source (#566).

## Verification

- `npm run typecheck` — passed
- focused `activityEventsSourceCntrlLocalePin` — 3/3
- `npm test` — 679 pass / 0 fail / 7 cancelled (withTimeout baseline)
- pgTAP plan **12** counted from 12 assertion call sites (Docker unavailable here)

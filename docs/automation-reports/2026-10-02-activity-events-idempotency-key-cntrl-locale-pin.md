# MISE-005FE activity_events.idempotency_key cntrl locale pin

Date: 2026-10-02
Branch: `cursor/mise-activity-events-idempotency-key-cntrl-locale-pin`
Base: `origin/main` @ `78da737`

## Change

- Additive migration `20261001350000_mise_005fe_activity_events_idempotency_key_cntrl_locale_pin.sql`
- Reattach `activity_events_idempotency_key_check`
- Preserve exact `length(trim(idempotency_key)) between 1 and 240`
- Add ASCII control rejection under COLLATE `"C"`:
  `idempotency_key collate "C" !~ '[[:cntrl:]]'`
- System idempotency keys (ISO timestamps, label text with spaces) — full
  `[[:cntrl:]]`, not a narrow ASCII charset and not a multiline allowlist

## Scope boundaries

CHECK-only SQL. Does not rewrite activity RPCs, title (#560), summary (#564),
source (#567), trigger_type (#568), trigger_reference, restaurant_memories.*,
or sibling table idempotency tips (#457/#459/#471).

## Verification

- `npm run typecheck` — passed
- focused `activityEventsIdempotencyKeyCntrlLocalePin` — 3/3
- `npm test` — 679 pass / 0 fail / 7 cancelled (withTimeout baseline)
- pgTAP plan **12** counted from 12 assertion call sites (Docker unavailable here)

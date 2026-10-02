# MISE-005FF restaurant_memories.dedupe_key cntrl locale pin

Date: 2026-10-02
Branch: `cursor/mise-restaurant-memories-dedupe-key-cntrl-locale-pin`
Base: `origin/main` @ `78da737`

## Change

- Additive migration `20261001360000_mise_005ff_restaurant_memories_dedupe_key_cntrl_locale_pin.sql`
- Reattach `restaurant_memories_dedupe_key_check`
- Preserve exact `length(trim(dedupe_key)) between 1 and 240`
- Add ASCII control rejection under COLLATE `"C"`:
  `dedupe_key collate "C" !~ '[[:cntrl:]]'`
- System keys (legacy supplier-name keys with spaces, durable supplier UUID
  keys, parked legacy keys) — full `[[:cntrl:]]`, not a narrow ASCII charset
  and not a multiline allowlist

## Scope boundaries

CHECK-only SQL. Does not rewrite supplier-delivery /
`update_restaurant_memory` writers, source (#566), statement (#563),
correction (#565), memory vocabulary (#511), or
`operational_issues.dedupe_key` (#456).

## Verification

- `npm run typecheck` — passed
- focused `restaurantMemoriesDedupeKeyCntrlLocalePin` — 3/3
- `npm test` — 679 pass / 0 fail / 7 cancelled (withTimeout baseline)
- pgTAP plan **12** counted from 12 assertion call sites (Docker unavailable here)

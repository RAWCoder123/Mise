# Home Gmail sender failure surfacing (2026-08-27)

Base: `origin/main` @ `20b28e5`  
Branch: `cursor/mise-product-inspection-bfd7`

## Problem

Home operating brief could report `on_track` while Gmail sender status was
`needs_reauth` or `restricted`. Today already surfaces connect/reconnect tasks;
Home and morning/pre-service phase briefs did not load email connection state.

## Change

- Load `fetchEmailConnectionState` in `fetchOperatingBrief` with tenant scope checks.
- Classify Gmail outlook: `ok` / `error` / `none` / `unknown`.
- Escalate pulse to `at_risk` only for evidenced `needs_reauth` or `restricted`.
- Surface monitoring row + Home banner route to `/settings/gmail`.
- Morning and pre-service phase briefs add urgent repair findings.
- Missing/unloaded Gmail does not escalate pulse alone (mirrors POS none/unknown).
- Never invent send success or provider message IDs.

## Verification

- `npm run typecheck`
- `npm test` (operatingBrief + dailyPhaseBrief focused, then full suite)

## Out of scope

- POS Home failure (#206)
- Operator notification mute categories (#207)
- Overdue mute, storage transfer, 004B composition

# Receive/waste station attribution main rebase (2026-11-05)

Tip: `cursor/mise-receive-waste-station-attribution-main-rebase` stacked on #1100.

## Why
Original #219 stacked on #215 storage locations. #1100 rebased storage onto
main with the MISE-004C activity allowlist fix. This tip rebases the attribution
commit onto #1100 so receive put-away and waste station deduction can land after
storage locations without replaying the pre-004C storage base.

## Changes vs #219
- Cherry-picked `Attribute receives and waste to storage stations` onto #1100.
- Renamed migration `20260828010000` → `20261105020000` so it runs after
  `20261105010000_storage_locations_and_transfer.sql`.
- Kept #1100 purchase-line activity allowlist security pin alongside putaway RPC pins.
- Updated test/report migration path references.

## Unlocks next
Rebase #234 (per-line putaway UI) onto this tip after it lands / stacks cleanly.

## Verification
- `npm run typecheck` passed
- `npm run security:static` passed
- `npm run security:backend` passed
- `npm test` 700 total / 693 pass / 0 fail / 7 cancelled
- Docker pgTAP deferred (hosted proof)

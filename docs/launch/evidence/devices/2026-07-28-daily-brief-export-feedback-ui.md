# UI evidence — Daily brief, export, and finding feedback

- timestamp_utc: 2026-07-28T20:20:00Z
- candidate_commit: 828555e3e78c53f49a3bcc0a40eb3b32d772e4f9
- cursor_feature_commit: a17c136
- testflight_build: not applicable; local rendered interaction proof only
- device_model: Mac arm64, Chrome mobile harness at 390x844
- device_os: macOS 26.5.2
- locales_verified: English, Español, 简体中文

## Workflows reviewed

- Daily Brief Now, Up next, and Later on `/today` and `/insights`
- Restart-safe finding feedback queue, list, flush, resume, and exact-snapshot
  status binding with no direct record call
- Owner/admin restaurant export entry from `/settings`
- Original evidence and recommendation retained after manager feedback
- Independent screen-reader controls retained inside each finding card

## Verification

- `npm run typecheck` — passed
- `npm test` — 303 passed
- `npm run design:static` — passed
- `npm run qa:interactions` — passed in all three locales with zero overflow on
  every existing route in the rendered smoke list
- `git diff --check` — passed

## Unresolved evidence

- This is not a physical-device or TestFlight receipt.
- `/settings/export` must be added to the rendered route harness.
- Native iOS share-sheet behavior, interruption recovery, and screen-reader
  focus order require real-device verification.

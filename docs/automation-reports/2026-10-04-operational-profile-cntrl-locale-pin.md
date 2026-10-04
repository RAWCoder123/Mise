# MISE-005HK: restaurants operational_profile cntrl locale pin

## Summary

Additive migration rewrites `private.restaurant_operational_profile_is_valid` so:

- `orderCadence` / `prepWindows` / `primarySuppliers` / `inventoryReviewDays`
  string entries reject ASCII controls under `COLLATE "C"` while keeping
  existing length bounds;
- `serviceStyle` allowlist compares under `COLLATE "C"`;
- `notes` reject unsafe ASCII controls under `COLLATE "C"` while allowing
  LF/TAB/CR (same multiline class as MISE-005EM `operator_note`).

The foundation validator used length-only text gates and a bare IN allowlist.
`restaurants.operational_profile` is durable operating-rhythm evidence; locale
drift under those bare gates can make dump/restore accept (or refuse) profile
bytes that disagree with a restored C-locale path.

Array entries and serviceStyle are single-line machine tokens. Notes are
operator-note-style multiline prose.

## Scope

- Validator-only; does not rewrite `private.update_restaurant_profile`
- Leaves restaurants.name (#548 / MISE-005EJ), address/cuisine
  (#549 / MISE-005EK), logo_url (#437), timezone (#462), currency (#436), and
  structured AI insight output (#626 / MISE-005HJ) untouched
- Alone-OK versus open #292 (UI-only operating-profile settings), #548, #549,
  #626

## Verification

- `npm run typecheck` passed
- focused `operationalProfileCntrlLocalePin` 4/4 passed
- `npm test` 680 pass / 0 fail / 7 cancelled (pre-existing
  `recalculationCycles` withTimeout hang)
- pgTAP plan 16 from 16 assertion call sites (Docker/pgTAP unavailable
  in this environment)

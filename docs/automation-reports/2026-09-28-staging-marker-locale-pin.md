# MISE-005BA: pin staging_marker CHECK and verify gate to COLLATE C

Date: 2026-09-28  
Branch: `cursor/mise-staging-marker-locale-pin`  
Base: `origin/main` @ `78da737`

## Summary

`private.environment_identity.staging_marker` still validated with a length-only
bound (`length(staging_marker) between 16 and 200`). `public.verify_staging_identity`
mirrored that length-only gate before comparing the caller marker to the
singleton row. Staging preflight and TestFlight QA child-env helpers also used
length-only client checks.

`staging_marker` is the non-secret environment identity that keeps disposable
staging scripts from aiming trusted credentials at production. It is the only
anonymous Data API callable comparison surface. Locale drift under a length-only
CHECK could accept a marker the restored C-locale ASCII gate would refuse (or
the reverse), breaking staging preflight continuity across dump/restore.

## Change

- Additive migration `20260928000100_mise_005ba_staging_marker_locale_pin.sql`
  - Replace length-only `staging_marker` CHECK with:
    `staging_marker collate "C" ~ '^[A-Za-z0-9._-]{16,200}$'`
  - Rewrite `public.verify_staging_identity` to the same COLLATE C class
  - Preserve existing `anon` + `authenticated` EXECUTE via CREATE OR REPLACE
    (do not re-emit the anon grant; security.test deepEquals a single corpus grant)
- Client: export `STAGING_MARKER_PATTERN` / `isStagingMarker` from
  `scripts/staging-preflight.mjs`; use from preflight + `safe-env.mjs`
  TestFlight QA gate
- Source-pin Jest (`tests/stagingMarkerLocalePin.test.ts`) and committed pgTAP
  (`staging_marker_locale_pin.test.sql`, plan 12)

## Scope boundaries

- Does **not** rewrite Square merchant_id (#460), Gmail sender_email (#423),
  OAuth state_hash/PKCE (#438), activity_events, restaurant_memories, or
  inventory_events (#375)
- Alone on main OK (`environment_identity` / `verify_staging_identity`
  unreplaced since original bound-resources migration)

## Verification

- Focused `stagingMarkerLocalePin` tests
- `npm run typecheck`
- `npm test` (full suite)

# MISE-005KK: Unicode-fold telemetry secret markers before match

Date: 2026-10-08

## Summary

Pin secret-marker scrubbing to Unicode case fold before lowercase-only pattern
match so Kelvin lookalikes cannot bypass redaction. Bare case-insensitive `/i`
patterns without the Unicode flag do not fold `K` → `k`, so keys/values like
`toKen`, `cooKie`, and `api_Key` previously escaped telemetry, Edge audit
metadata, restaurant-export, and QA child-env secret scrubbers.

## Why

Identity tips (MISE-005B–005KJ) pin operational identity to ASCII C so Kelvin
cannot *invent* matches. Secret scrubbers need the opposite: Unicode inventing
so lookalike spellings of `token` / `cookie` / `api_key` still redact. After
the gmailMessageId builder tip (#705), remaining lower-priority identity needles
lacked proven inventing vectors; this redaction bypass is a higher-impact
security gap with a proven Kelvin miss under `/i`.

## Change

- `services/domain/telemetrySecurity.ts`: export `unicodeFoldTelemetryText` /
  `hasForbiddenTelemetryMarker`; fold before lowercase-only markers (including
  email/bearer value patterns)
- `supabase/functions/_shared/mise.ts`: Edge `safeFunctionMetadata` scrubbing
  shares `hasForbiddenTelemetryMarker`
- `services/repositories/repositoryContracts.ts`: export protected-key check
  folds with `key.toLowerCase()` then lowercase-only pattern
- `scripts/safe-env.mjs`: child-env refuse-to-pass check folds the same way
- Focused tests proving `/i` misses Kelvin, Unicode fold catches it, and ASCII C
  would wrongly miss it
- Automation report

## Verification

- `npm run typecheck`
- focused `tests/telemetrySecretMarkerUnicodeFold.test.ts`
- `npm test`
- `npm run security:static` / `npm run security:backend` when available

## Out of scope

- Landing/rebasing open stacks #348–#705
- Re-tipping identity ASCII C fields (#705/#704/…/#410)
- Error-message haystacks / InventoryHealth / matchSupportedLocale (weak inventing)
- Contested SQL mutators / ingest rewrites
- Founder legal/EAS / live POS/Gmail / TestFlight

# MISE-005KQ: pin outreach-agent local requireUuid to ASCII C

Date: 2026-10-08  
Branch: `cursor/mise-outreach-require-uuid-ascii-c`  
Base: `origin/main` @ `78da7376`

## Problem

`supabase/functions/outreach-agent/index.ts` kept a local `requireUuid` that
normalized via `requireString(...).toLowerCase()`. `String.prototype.trim()`
strips Unicode spaces such as NBSP (`U+00A0`) and em space (`U+2003`), so a
padded campaign, lead, or message UUID could invent the same canonical identity
as the unpadded value. Shared Edge `requireUuid` in `_shared/mise.ts` is covered
separately by MISE-005KP / PR #719; this tip does not retarget that call site.

## Fix

- Add `supabase/functions/_shared/uuidIdentity.ts` with ASCII-only end trim and
  ASCII A–Z fold helpers (byte-compatible with MISE-005KP).
- Wire outreach-agent's local `requireUuid` through `requireCanonicalEdgeUuid`,
  wrapping failures as `HttpError(400, ...)`.
- Leave `_shared/mise.ts` `requireUuid` on the pre-005KP path so #719 remains
  the sole shared-wiring tip.

## Tests

- `tests/outreachRequireUuidAsciiC.test.ts` proves source pinning, ASCII case
  fold stability, Kelvin fail-closed behavior, and NBSP / em-space inventing
  rejection.

## Verification

- `npm run typecheck`
- `node --test --import tsx tests/outreachRequireUuidAsciiC.test.ts`
- `npm test`
- `npm run security:static`
- `npm run security:backend`

## Out of scope

- Shared `mise.ts` requireUuid (#719)
- Edge `isCanonicalEmail` reject-non-lower
- Secret scrubbers (#706)
- Live outreach send / Gmail credentials

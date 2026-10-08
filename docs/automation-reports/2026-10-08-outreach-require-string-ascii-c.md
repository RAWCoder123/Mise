# MISE-005KU: pin outreach-agent requireString identity to ASCII C

Date: 2026-10-08  
Branch: `cursor/mise-outreach-require-string-ascii-c`  
Base: `origin/main` @ `78da737`

## Problem

The outreach-agent Edge function keeps a local `requireString` (length-bounded)
that used Unicode `String.prototype.trim()`. That trim strips NBSP (`U+00A0`) and
em-space (`U+2003`) padding, inventing a normalized action, campaign field,
header line, or mailbox input identity. Shared Edge `requireString` in `mise.ts`
is owned by MISE-005KT (#723) and does not cover this local path. Local
`requireUuid` is owned by MISE-005KQ (#720).

## Change

- Added `supabase/functions/_shared/outreachStringIdentity.ts` with ASCII-only
  end trim and fail-closed `requireCanonicalOutreachString`.
- Routed outreach-agent local `requireString` through that helper, preserving
  the existing HttpError / length-budget contract.
- Left `mise.ts` `requireString`, local `requireUuid`, `isCanonicalEmail`, and
  secret scrubbers untouched.
- Added `tests/outreachRequireStringAsciiC.test.ts` inventing proofs.

## Verification

- Focused: `node --test tests/outreachRequireStringAsciiC.test.ts`
- `npm run typecheck`
- `npm test` (broader suite)
- `npm run security:static` / `npm run security:backend` when available

## Do not

- Re-tip #723 / Edge `requireString` / `requireEnum` / `requireIsoDateString`
- Re-tip #720 / #719 UUID identity
- Tip Edge `isCanonicalEmail` reject-non-lower or #706 scrubbers to ASCII C
- Re-tip `normalizeOutreachEmail` (#420)

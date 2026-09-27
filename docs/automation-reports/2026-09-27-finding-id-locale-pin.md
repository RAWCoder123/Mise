# MISE-005AH: finding_id locale pin

Date: 2026-09-27  
Branch: `cursor/mise-finding-id-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`public.operational_finding_decisions.finding_id` had only a length CHECK, and
`public.record_operational_finding_decision` gated shape with bare
`trim(p_finding_id) !~ '^finding:[a-z0-9][a-z0-9:_-]{1,231}$'`. POSIX
character classes follow database `LC_CTYPE`; MISE-005A proved locale drift on
this cluster. MISE-005AF (#440) pinned `policy_version` on the same table and
RPC but intentionally deferred `finding_id`.

`finding_id` is restore and feedback-write authority. Accepted values are
stored on append-only finding decisions and compared for exact-retry
continuity. Under locale drift, the RPC preflight and a restore CHECK could
disagree on the same manager-feedback bytes.

## Fix

Additive migration
`20260927000500_mise_005ah_finding_id_locale_pin.sql`:

1. Attaches `operational_finding_decisions_finding_id_shape_check` with
   `finding_id collate "C" ~ '^finding:[a-z0-9][a-z0-9:_-]{1,231}$'`
   (keeps the existing length CHECK).
2. Rewrites `public.record_operational_finding_decision` so the finding_id
   shape gate uses `trim(p_finding_id) collate "C" !~ '…'`.
3. Preserves authenticated EXECUTE (manager feedback path).

## Out of scope

- Does not pin `policy_version` (owned by open #440)
- Does not rewrite `private.service_record_mise_action_failure`
- Does not rewrite evidence hardening or fixed decision enums

## Compose

Prefer rebase onto #440 after it lands (shared
`record_operational_finding_decision`). Alone on main is safe because #440
left finding_id bare. Timestamp after MISE-005AG (#441).

## Verification

- `npm run typecheck`
- focused `tests/findingIdLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; not executed here (no Docker)

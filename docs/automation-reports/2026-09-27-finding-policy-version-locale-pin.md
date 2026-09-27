# MISE-005AF: finding policy_version locale pin

Date: 2026-09-27  
Branch: `cursor/mise-finding-policy-version-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`public.operational_finding_decisions.policy_version` still used a bare
`policy_version ~ '^[a-z0-9][a-z0-9._-]{2,63}$'` CHECK, and
`public.record_operational_finding_decision` mirrored it with bare
`trim(p_policy_version) !~ '…'`. POSIX character classes follow database
`LC_CTYPE`; MISE-005A proved locale drift on this cluster.

`policy_version` is restore and feedback-write authority. Accepted values are
stored on append-only finding decisions and compared for exact-retry
continuity. Under locale drift, dump/restore and the RPC preflight could
disagree on the same manager-feedback bytes.

## Fix

Additive migration
`20260927000300_mise_005af_finding_policy_version_locale_pin.sql`:

1. Drops any bare `policy_version` CHECK and reattaches
   `operational_finding_decisions_policy_version_check` with
   `policy_version collate "C" ~ '^[a-z0-9][a-z0-9._-]{2,63}$'`.
2. Rewrites `public.record_operational_finding_decision` so the
   policy_version shape gate uses
   `trim(p_policy_version) collate "C" !~ '…'`.
3. Preserves authenticated EXECUTE (manager feedback path).

## Out of scope

- Does not pin `finding_id` shape (same class risk; separate tip)
- Does not rewrite `private.service_record_mise_action_failure`
- Does not rewrite evidence hardening or fixed decision enums

## Compose

Must apply after `append_operational_finding_decisions`. Compose-safe alone
on main (`record_operational_finding_decision` unreplaced since that
migration). Timestamp after MISE-005AE (#439).

## Verification

- `npm run typecheck`
- focused `tests/findingPolicyVersionLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; not executed here (no Docker)

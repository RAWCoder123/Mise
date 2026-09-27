# MISE-005AP: provider failure_code / last_error_code CHECK locale pin

Date: 2026-09-27  
Branch: `cursor/mise-provider-failure-code-check-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

On main, durable provider failure columns only have length bounds:

```sql
failure_code / last_error_code is null
or length(...) between 1 and 80
```

Writers route through `private.gmail_safe_error_code`, which still gates with
bare:

```sql
p_error_code !~ '^[a-z0-9_]{1,80}$'
```

MISE-005AE (#439) pins that helper under `COLLATE "C"`, and MISE-005AO (#449)
attached `public.mise_actions.error_code`, but left:

- `private.gmail_oauth_flows.failure_code`
- `private.square_oauth_flows.failure_code`
- `private.supplier_email_deliveries.last_error_code`

on length-only CHECKs that accept tokens the restored C-locale writer would
refuse. Under `LC_CTYPE` drift, dump/restore and writer↔table continuity can
disagree for Gmail/Square OAuth and supplier-send failure evidence.

## Fix

Additive migration
`20260927130000_mise_005ap_provider_failure_code_check_locale_pin.sql`
replaces those length-only CHECKs with named nullable-or-shape CHECKs:

```sql
col is null
or col collate "C" ~ '^[a-z0-9_]{1,80}$'
```

Null remains legal for successful / unfinished rows. Hardcoded snake_case
tokens already written by flows (`superseded`, `stale_send_claim`,
`legacy_unproven_claim`) remain valid.

## Out of scope

- Does not rewrite `private.gmail_safe_error_code` (open #439)
- Does not rewrite OAuth `state_hash` / PKCE pins (open #438)
- Does not rewrite `provider_message_id` CHECKs (open #444 / #445)
- Does not rewrite delivery fingerprint CHECKs (open #447)
- Does not rewrite `mise_actions.error_code` (open #449)
- Does not change domain error-code allowlists (ASCII snake_case already)

## Compose

Compose-safe alone on main. CHECK-only; no function rewrite. Prefer after
MISE-005AE (#439) so writer + table pins agree; timestamp after MISE-005AO
(#449). Compatible with open #438/#444/#445/#447 because those paths own
different columns or compound constraints on the same tables.

## Verification

- `npm run typecheck`
- focused `tests/providerFailureCodeCheckLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; not executed here (no Docker)

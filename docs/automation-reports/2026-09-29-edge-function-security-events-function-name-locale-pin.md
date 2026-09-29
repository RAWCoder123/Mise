# MISE-005BZ: pin edge_function_security_events.function_name CHECK to COLLATE C

Date: 2026-09-29
Branch: `cursor/mise-edge-function-security-events-function-name-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `edge_function_security_events_function_name_check` on
`private.edge_function_security_events` with the exact-token allowlist plus
ASCII shape under COLLATE `"C"`:

```sql
function_name in (
  'sync-pos-sales', 'generate-ai-insights', 'link-gmail',
  'gmail-oauth-callback', 'send-supplier-email', 'operational-workflows',
  'delete-account', 'export-restaurant-data',
  'link-square', 'square-oauth-callback', 'square-webhooks'
)
and function_name collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII kebab-case mint (`EdgeFunctionName` in
`supabase/functions/_shared/mise.ts` and `private.edge_function_policy`):

- `sync-pos-sales`
- `generate-ai-insights`
- `link-gmail`
- `gmail-oauth-callback`
- `send-supplier-email`
- `operational-workflows`
- `delete-account`
- `export-restaurant-data`
- `link-square`
- `square-oauth-callback`
- `square-webhooks`

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. Sibling provenance/identity
gates through MISE-005BY (#485) are pinned under COLLATE C, but
`edge_function_security_events.function_name` remained on bare IN only.
Without a dedicated COLLATE C shape CHECK, dump/restore under LC_CTYPE drift
can accept firewall-identity bytes the restored C-locale path would refuse —
or the reverse — breaking Edge Function reservation continuity across restore.

## Scope

- CHECK-only on `edge_function_security_events_function_name_check`
- Does **not** rewrite `private.edge_function_policy`
- Does **not** rewrite reservation / terminal event writers
- Does **not** rewrite Edge Function TypeScript allowlists
- Alone on main OK; timestamp after #485 (`20260929120000`)

## Verification

- `npm run typecheck`
- focused `tests/edgeFunctionSecurityEventsFunctionNameLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; Docker/hosted pgTAP not run here

## Files

- `supabase/migrations/20260929120000_mise_005bz_edge_function_security_events_function_name_locale_pin.sql`
- `supabase/tests/database/edge_function_security_events_function_name_locale_pin.test.sql`
- `tests/edgeFunctionSecurityEventsFunctionNameLocalePin.test.ts`
- `docs/automation-reports/2026-09-29-edge-function-security-events-function-name-locale-pin.md`

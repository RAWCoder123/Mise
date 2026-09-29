# MISE-005CA: pin edge_function_security_events.event_type CHECK to COLLATE C

Date: 2026-09-29
Branch: `cursor/mise-edge-function-security-events-event-type-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `edge_function_security_events_event_type_check` on
`private.edge_function_security_events` with the exact-token allowlist plus
ASCII shape under COLLATE `"C"`:

```sql
event_type in (
  'allowed', 'denied', 'rate_limited', 'blocked', 'completed', 'error'
)
and event_type collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII snake_case mint (`reserve_edge_function_invocation`,
`record_edge_function_security_event`, and
`supabase/functions/_shared/mise.ts`):

- `allowed`
- `denied`
- `rate_limited`
- `blocked`
- `completed`
- `error`

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. MISE-005BZ (#486) pinned the
sibling `function_name` gate under COLLATE C, but
`edge_function_security_events.event_type` remained on bare IN only.
Without a dedicated COLLATE C shape CHECK, dump/restore under LC_CTYPE drift
can accept firewall-classification bytes the restored C-locale path would
refuse — or the reverse — breaking Edge Function reservation and rate-limit
continuity across restore.

## Scope

- CHECK-only on `edge_function_security_events_event_type_check`
- Does **not** rewrite reservation / completion writers
- Does **not** rewrite `private.edge_function_policy`
- Does **not** rewrite `function_name` (#486 / MISE-005BZ)
- Alone on main OK; timestamp after #486 (`20260929130000`)

## Verification

- `npm run typecheck`
- focused `tests/edgeFunctionSecurityEventsEventTypeLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; Docker/hosted pgTAP not run here

## Files

- `supabase/migrations/20260929130000_mise_005ca_edge_function_security_events_event_type_locale_pin.sql`
- `supabase/tests/database/edge_function_security_events_event_type_locale_pin.test.sql`
- `tests/edgeFunctionSecurityEventsEventTypeLocalePin.test.ts`
- `docs/automation-reports/2026-09-29-edge-function-security-events-event-type-locale-pin.md`

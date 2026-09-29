# MISE-005CB: pin users.preferred_locale CHECK and writer to COLLATE C

Date: 2026-09-29
Branch: `cursor/mise-preferred-locale-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `users_preferred_locale_allowlist_check` on `public.users`
with the exact-token allowlist plus ASCII shape under COLLATE `"C"`, and mirror
the same contract in `public.update_my_preferred_locale`:

```sql
preferred_locale is null
or (
  preferred_locale in ('en', 'es', 'zh-Hans')
  and preferred_locale collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
)
```

Writer gate:

```sql
p_locale is null
or p_locale not in ('en', 'es', 'zh-Hans')
or p_locale collate "C" !~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (operator display preference only):

- `en` — English
- `es` — Spanish
- `zh-Hans` — Simplified Chinese

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it on both the table CHECK and the identity-free writer RPC.

## Why

MISE-005A proved locale drift on this cluster. Later 005* tips pinned
machine-identity and provenance allowlists under COLLATE C, but left the
operator `preferred_locale` bare-IN CHECK and writer gate unpinned. Without a
dedicated COLLATE C shape gate, dump/restore under LC_CTYPE drift can accept
preference bytes the restored C-locale path would refuse — or the reverse —
breaking operator language preference continuity across restore.

`preferred_locale` remains operator display preference only and is never an
authorization input. Restaurant authority stays in active
`restaurant_memberships`. The writer remains `auth.uid()`-bound.

## Scope

- CHECK + writer pin on `users_preferred_locale_allowlist_check` /
  `update_my_preferred_locale`
- Does **not** rewrite `get_my_preferred_locale`
- Does **not** touch users RLS, restaurant settings, or i18n catalog
- Does **not** touch contested stacks (activity_events, restaurant_memories,
  edge_function_security_events, insights)
- Alone on main OK; timestamp after #487 (`20260929140000`)

## Verification

- `npm run typecheck`
- focused `tests/preferredLocaleLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; Docker/hosted pgTAP not run here

## Files

- `supabase/migrations/20260929140000_mise_005cb_preferred_locale_locale_pin.sql`
- `supabase/tests/database/preferred_locale_locale_pin.test.sql`
- `tests/preferredLocaleLocalePin.test.ts`
- `docs/automation-reports/2026-09-29-preferred-locale-locale-pin.md`

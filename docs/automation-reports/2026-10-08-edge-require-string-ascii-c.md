# MISE-005KT: pin Edge requireString identity to ASCII C

Date: 2026-10-08  
Branch: `cursor/mise-edge-require-string-ascii-c`  
Base: `origin/main` @ `78da7376`

## Gap

`requireString` / `requireEnum` / `requireIsoDateString` in
`supabase/functions/_shared/mise.ts` used Unicode-aware `.trim()` when
canonicalizing Edge string identities (link-square / link-gmail / sync-pos /
operational-workflows actions, ISO `from`/`to` bounds, and
`delete_my_account` confirmation).

Unicode `trim()` strips NBSP / em-space around an otherwise-valid token,
inventing a normalized identity from padded input. Proof:

- `"\u00a0delete_my_account\u00a0".trim() === "delete_my_account"`
- `"\u00a02026-10-08T00:00:00.000Z\u00a0".trim()` parses as a finite Date

## Change

- Pure helpers in `supabase/functions/_shared/stringIdentity.ts` (MISE-005KT)
- ASCII-only end trim before required / enum / ISO checks
- `requireString`, `requireEnum`, and `requireIsoDateString` wrap the pure
  helpers with `HttpError(400, …)`
- Focused static + behavioral tests; this report

Complements open MISE-005KP / #719 (`requireUuid`) without retargeting UUID
canonicalization, outreach-agent’s local `requireString`, Edge
`isCanonicalEmail`, or #706 secret scrubbers.

## Verification

- `npm run typecheck`
- focused `tests/edgeRequireStringAsciiC.test.ts`
- `npm test`
- `npm run security:static`
- `npm run security:backend`

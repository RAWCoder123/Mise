# Operator display-name settings (2026-08-28)

## Gap
`update_my_profile` already existed as an authenticated RPC and demo write path, but Settings had no UI. Hosted session hydration ignored `public.users.name` and used only the email local-part.

## Fix
- Domain: `normalizeOperatorDisplayName` / `resolveOperatorDisplayName` (1–120).
- Migration `20260828043000_operator_display_name_read.sql`: identity-free `get_my_display_name()`.
- Repository `fetchMyDisplayName`; application uses domain normalize; session hydrates + `applyOperatorDisplayName`.
- Settings `/settings/profile` + Preferences hub row; i18n EN/ES/zh-Hans.
- Writes stay on existing `update_my_profile` (not Edge); reads never accept a caller-selected user id.
- Tests: `operatorDisplayName.test.ts`, `operatorDisplayNameSecurity.test.ts`, pgTAP `operator_display_name.test.sql`.

## Verification
- `npm run typecheck`
- `npm test` (operator display-name + security suites)
- `npm run security:static` / `npm run security:backend` when available
- Docker `supabase:test` still pending in this environment

## Classification
Controlled pilot-ready improvement; App Store / hosted migration deploy remain external.

# Operator display-name settings (2026-08-02)

## Gap
`updateMyProfile` / Edge `service_update_my_profile` already existed, but Settings had no UI to edit an operator display name. Hosted session hydration also derived the name from the email local-part and ignored `public.users.name`, so saved names would not resurface after refresh.

## Change
- Domain: `normalizeOperatorDisplayName` / `resolveOperatorDisplayName` with 1–120 character bounds matching Postgres.
- Migration `20260802180000_operator_display_name_read.sql`: identity-free `get_my_display_name()`.
- Repository `fetchMyDisplayName` (demo + hosted RPC); application validation uses the domain helper.
- Session hydration loads the stored display name; `applyOperatorDisplayName` updates the in-session user after saves.
- Settings → Display name (`/settings/profile`) with EN/ES/zh-Hans copy; Preferences hub row.
- Unit, security contract, and pgTAP coverage authored; route smoke includes `/settings/profile`.

## Behavior
1. Display names are personal operator profile metadata, never authorization inputs.
2. Hosted reads use `auth.uid()` through `get_my_display_name`; writes remain Edge-owned `update_my_profile`.
3. Email remains the sign-in identity and is shown read-only on the profile screen.
4. Demo mode persists the name in local demo state / session snapshot.

## Verification
- `npm run typecheck`
- `npm test` (387)
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes` (includes `/settings/profile`)
- Docker `supabase:test` still pending in this environment

## Classification
Still **controlled pilot-ready** pending Docker/hosted re-proof and founder App Store/credentials steps.

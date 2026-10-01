# Privacy URL HTTPS fail-closed scaffolding

Date: 2026-08-28  
Branch: `cursor/mise-privacy-url-fail-closed`  
Base: `origin/main` @ `20b28e5`

## Problem

`/settings/privacy` hard-coded `https://getmise.app/privacy` and always offered an
Open URL action. That destination is not yet hosted, so the button could open a
dead or misleading public address. Terms scaffolding (#147) already used an
HTTPS-only env gate; privacy did not.

## Change

- `PublicAppConfig.privacyUrl` from `EXPO_PUBLIC_PRIVACY_URL` via shared
  `normalizeOptionalHttpsUrl` (HTTPS only; http/ftp/malformed → null)
- Privacy screen fail-closed when unset: missing notice, disabled Open button
- When configured: hosting-pending caution (does not claim the page is live)
- EN / ES / zh-Hans copy updated; hard-coded public privacy URL removed from UI
- `.env.example` + `security-static` allowlist for `EXPO_PUBLIC_PRIVACY_URL`
- Tests: HTTPS fail-closed in `security.test.ts`; store privacy contract updated

## Founder still required

- Publish legal privacy HTTPS copy
- Set `EXPO_PUBLIC_PRIVACY_URL` in EAS / env

## Out of scope

- Terms URL scaffolding remains #147
- Support mailto contacts unchanged
- Claiming public privacy hosting is live

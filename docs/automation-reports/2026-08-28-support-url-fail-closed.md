# Support URL HTTPS fail-closed scaffolding

Date: 2026-08-28  
Branch: `cursor/mise-support-url-fail-closed`  
Base: `origin/main` @ `20b28e5`

## Closed

- `PublicAppConfig.supportUrl` from `EXPO_PUBLIC_SUPPORT_URL` via HTTPS-only `normalizeOptionalHttpsUrl`
- `/settings/support` Open support page URL action fails closed when unset / http / ftp / malformed
- Mailto support and privacy actions retained for operator contact without claiming a live public page
- Missing vs hosting StatusNotice states in EN / ES / zh-Hans
- security-static allowlist + `.env.example` coverage

## Why

App Store listing requires a Support URL. Main previously offered only mailto drafts and never exposed a fail-closed HTTPS support destination. Hard-coding `https://getmise.app/support` would claim a page that has timed out in prior release evidence.

## Verification

- `npm run typecheck`
- Targeted tests for security + store privacy/support + localization
- `npm run security:static`
- `npm run design:static` (if available)

## Founder still required

- Publish public support HTTPS page (listing target `https://getmise.app/support`)
- Set `EXPO_PUBLIC_SUPPORT_URL` in EAS / release env
- Confirm inbox monitoring for support@ / privacy@

## Do not claim

- That getmise.app/support is live
- That mailto inboxes are actively monitored

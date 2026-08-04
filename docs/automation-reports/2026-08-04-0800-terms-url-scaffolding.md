# Automation report — Terms of service URL scaffolding

Date: 2026-08-04 ~08:00 UTC  
Branch: `cursor/mise-product-inspection-4469` (reset from `origin/cursor/mise-product-inspection-f835` @ `85c34c8`)

## Completed

- Added `EXPO_PUBLIC_TERMS_URL` to public app config with the same HTTPS-only normalization used for privacy/support.
- Wired a Settings → Account Terms of service row that opens the URL or fails closed with a localized caution notice when missing/invalid.
- Localized English, Spanish, and Simplified Chinese copy for the terms title and missing-config message.
- Allowlisted the env var in `scripts/security-static.mjs` and documented it in `.env.example`.
- Extended security tests for HTTPS-only legal URL acceptance and Settings wiring.
- Updated App Store / security / code-status readiness notes.

## Workflows now functioning (code-verified)

- Settings legal links: Privacy, Terms, Support all share the fail-closed external open path.
- Unconfigured or non-HTTPS terms URLs never open and surface `settings.account.termsMissing`.

## Tests added / expected

- `public legal URLs accept HTTPS only and fail closed otherwise`
- Settings contract assertion for `termsUrl` / `EXPO_PUBLIC_TERMS_URL`
- Existing localization catalog key parity covers the new keys

## Remaining

- Founder must publish legal copy and set `EXPO_PUBLIC_TERMS_URL` (and privacy/support) in EAS/env.
- Docker/hosted security re-proof, Apple Developer / TestFlight, live POS/Gmail remain external blockers.

## Classification

Controlled pilot-ready only after Docker/hosted security gates; not App Store submission-ready.

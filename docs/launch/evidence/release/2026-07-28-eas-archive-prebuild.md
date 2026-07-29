# EAS iOS archive and pre-build evidence

Verified: 2026-07-28

Source checkpoint:
`550e3844d28bc9eb61bdc8666f80951c9f7cc93e`

## Archive boundary

The first read-only EAS archive inspection showed that local `.cursor` state
and the independent marketing-site repository existed in the inspection tree.
Protected staging environment files were already absent.

Mise now has an explicit `.easignore` and fail-closed archive policy covering:

- `.env`, `.env.*`, and `.mise-staging.env`;
- `.cursor` and editor state;
- the independent `site` repository;
- launch documentation and operational scripts;
- Supabase migrations, functions, tests, and local state;
- application tests and generated output; and
- certificate, provisioning-profile, and source-control artifacts.

The post-checkpoint EAS archive inspection confirmed zero files beneath:

- `.cursor`;
- `site`;
- `docs`;
- `scripts`;
- `supabase`; and
- `tests`.

It also confirmed `.env` and `.mise-staging.env` were absent and found none of
the protected staging, Sentry-auth, or PostHog-personal credential names in the
remaining mobile upload.

## Automated verification

- `npm run qa:eas-archive`: passed.
- `npm run typecheck`: passed.
- `npm test`: 330 passed.
- `tests/testflightTooling.test.ts` now requires the archive gate in the
  TestFlight preflight.
- `ios:testflight:check` runs archive and EAS-account checks before the local
  Xcode gate.

## Pre-build boundary

The EAS iOS Preview pre-build inspection:

- loaded only the Preview Supabase and PostHog client variables;
- selected `staging`, internal distribution, and a physical-device profile;
- found the organization-owned remote iOS credential configuration; and
- stopped before native generation because Apple account authorization is
  required to generate or fully validate the signing credentials.

No native project, cloud build, signing mutation, archive upload, TestFlight
submission, or production action was produced.

## Required handoff

Raymond must complete the Apple account authorization prompt in a controlled
interactive EAS credential flow. Codex must then rerun the pre-build
inspection, record the signing-team and bundle-ID match without exposing
credentials, and only start an internal build under a separately recorded
batch.

# PostHog live staging receipt

Verified: 2026-07-28T23:43:14.046Z

## Scope

The connected PostHog organization is `Mise`. Its current project is the sole
target for the August 3 preview telemetry configuration.

The EAS `preview` environment now contains:

- `EXPO_PUBLIC_POSTHOG_KEY`, project-scoped with sensitive visibility; and
- `EXPO_PUBLIC_POSTHOG_HOST`, project-scoped and set to
  `https://us.i.posthog.com`.

No PostHog personal API key was stored in EAS, printed, or committed. The EAS
production environment was not changed.

## Controlled receipt

One synthetic `mise_beta_observability_proof` event was accepted and then
queried through the connected PostHog project:

- event UUID: `019fab1c-6a7e-7dd6-800f-611508fe0521`
- timestamp: `2026-07-28T23:43:14.046Z`
- environment: `staging`
- release: `mise-mobile@0.1.0+2`
- operation: `observability_receipt_proof`
- request ID: `79cf316e-1e55d1ab-a41509ff-a499b841`
- operation ID: `067adbce-6cfa3427-40d3003b-823909a4`
- restaurant ID: `not_applicable`
- authoritative event ID: `not_applicable`
- redaction marker: `[redacted]`

The event contained no restaurant, user, email, supplier, inventory, CSV,
provider, or credential payload.

## Verification

- PostHog event-schema inspection exposed exactly the expected bounded
  correlation and redaction properties.
- A time-bounded HogQL query returned the exact event UUID and values above.
- `eas config --platform ios --profile preview --non-interactive` confirmed the
  PostHog key and host load only into Preview alongside the existing staging
  Supabase client configuration.
- `npm run observability:check` passed the static correlation, redaction, and
  environment-isolation contract.

## Boundary

This closes the controlled PostHog receipt itself. It does not close Sentry,
alert delivery, real-device telemetry, or TestFlight evidence.

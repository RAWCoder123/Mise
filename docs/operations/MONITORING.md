# Mise Private-Beta Monitoring

Owner: Raymond Wong

Backup owner: designated beta support engineer before restaurant admission

Support channel: the monitored address recorded in the TestFlight beta notes

Monitoring is advisory. Sentry, PostHog, or their network paths must never block
authentication, inventory evidence, CSV import, findings, or draft review.

## Environment boundary

- EAS `preview` uses only the EAS `preview` environment and the staging
  Supabase, Sentry, and PostHog projects.
- EAS `production` uses only the EAS `production` environment. Production
  values are not created until the production go/no-go.
- Client bundles receive public DSNs/project keys only. Sentry auth tokens,
  PostHog personal API keys, Supabase service-role keys, and provider secrets
  remain server/operator-only.
- Edge Functions use server-only `SENTRY_DSN`, `MISE_APP_ENV`, and
  `MISE_RELEASE`.

## Required correlation

Every captured event contains:

- `app_env`
- `release`
- `operation`
- `request_id`
- `operation_id`
- `restaurant_id`, or `not_applicable`
- `authoritative_event_id`, or `not_applicable`

Raw request bodies, emails, names, tokens, cookies, credentials, raw errors,
and restaurant-entered notes are prohibited. The app Sentry `beforeSend`
handler emits an allowlisted event shape and removes user, request, breadcrumb,
and raw message fields.

## Alerts and ownership

| Signal | Staging threshold | Beta threshold | First owner | First action |
| --- | --- | --- | --- | --- |
| Authentication/authorization denial | Any controlled proof; investigate unexpected bursts | 5 in 10 minutes | Raymond | Check release, tenant, and role changes; do not weaken authorization |
| Edge Function error | Any unexpected error | 2 for one operation in 10 minutes | Raymond | Pause the affected integration or enter read-only mode |
| Inventory conflict | Any unexpected conflict in walkthrough | 3 for one restaurant in 30 minutes | Raymond | Stop retries, preserve both event identities, reconcile manually |
| Tenant-boundary denial | Any non-test event | Any event | Raymond | Treat as P0; enter emergency/read-only mode and follow the incident runbook |
| Telemetry silence | Controlled proof absent | No beta heartbeat for one operating day | Raymond | Check provider configuration; core workflows remain available |

Before restaurant admission, replace “designated beta support engineer” with a
named person and configure provider notifications to the monitored support
address. Record screenshots or provider rule IDs in
`docs/launch/evidence/observability/`; do not commit API credentials.

## Receipt proof

Static configuration:

```sh
npm run observability:check
```

Credentialed staging proof:

```sh
MISE_OBSERVABILITY_LIVE=1 npm run observability:check
```

The live command requires the staging Sentry DSN, org/read token, PostHog
project key, host, project ID, and personal read key as `MISE_*` environment
variables. It sends one generic Sentry error and one PostHog event containing a
literal `[redacted]` probe, then queries each provider for receipt. Its output
contains only correlation and provider event IDs and is suitable launch
evidence.

## Triage

1. Record environment, release, operation, request ID, and operation ID.
2. Confirm whether one or multiple restaurants are affected without copying
   restaurant-entered content into the incident channel.
3. Apply the narrowest kill switch or system mode.
4. Preserve authoritative inventory and decision evidence.
5. Reproduce in staging.
6. Record owner, severity, mitigation, and exit criteria in the launch ledger.

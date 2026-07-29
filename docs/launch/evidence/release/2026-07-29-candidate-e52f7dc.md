# Provisional beta candidate evidence — `e52f7dc`

Candidate commit:
`e52f7dc412969b4a1897f0f007df7543b1e11727`

Verified at: `2026-07-29T01:15:50Z`

This is a provisional invite-only TestFlight beta candidate. Recording these
receipts does not approve Apple credential creation, a build, upload,
submission, TestFlight distribution, restaurant admission, or public release.

## Local release gate

`npm run verify:private-beta-security:local` passed at the exact candidate:

- TypeScript and all 330 application/domain/security tests passed.
- npm audit found zero vulnerabilities.
- Expo Doctor, backend security, and static design checks passed.
- All 566 pgTAP assertions and the bounded concurrent allocation proof passed.
- Local Supabase security advisors reported no issues.
- Production web export and every required HTTP route passed.
- English, Spanish, and Simplified Chinese interaction QA passed at 390x844
  with zero horizontal overflow.

## Hosted security

`npm run verify:private-beta-security:hosted` passed at the exact candidate
without skipped checks:

- server-only staging fixture bootstrap passed;
- all seven rendered workspace-switch and mutation races passed;
- tenant workflow authority, bounds, atomicity, service-RPC binding, Edge
  concurrency, tenant forgery, roles, rate limits, and append-only finding
  decisions passed; and
- restaurant export returned 25 tenant-scoped datasets, enforced owner/admin
  authority, denied cross-tenant access, bounded counts, and emitted no
  credentials.

## Tenant isolation

The exact candidate passed all local database and hosted rendered two-tenant
proofs. Cross-tenant reads and mutations remained denied, and stale requests
from one restaurant never replaced the active restaurant after a switch.

## Provider restrictions

The dedicated staging provider proof passed at the exact candidate:

- Square sync/webhooks, Gmail delivery, AI insights, order drafting, and Stripe
  invoicing are off;
- every staging tenant has a complete default-off control row;
- ordering policy is `off`;
- the obsolete unguarded Gmail claim remains unavailable; and
- a blocked supplier-delivery attempt created no delivery evidence.

## PostHog receipt

The corrected candidate revalidated the existing controlled staging event:

- event UUID: `019fab1c-6a7e-7dd6-800f-611508fe0521`
- environment: `staging`
- release: `mise-mobile@0.1.0+2`
- operation: `observability_receipt_proof`
- correlation contract: complete and bounded
- restaurant and authoritative-event fields: `not_applicable`
- redaction marker: `[redacted]`

The query selected only the named bounded properties and returned no
restaurant, user, contact, supplier, inventory, CSV, provider, or credential
payload.

## TestFlight boundary

The candidate adds the dedicated EAS `testflight` profile at code checkpoint
`041f224b375fc61088588debfb47aee73ce4a43a`:

- `distribution: store`, not ad hoc/internal;
- Preview/staging runtime isolation;
- deterministic reviewer demo access;
- release identity `mise-mobile@0.1.0+2`; and
- matching named build and submit profiles.

EAS configuration and archive inspection passed. The App Store pre-build
selected remote credentials and stopped at the Raymond-controlled Apple login
boundary. EAS still has no distribution certificate or provisioning profile
for `com.mise.mobile`. No signing mutation, cloud build, upload, submission, or
production action occurred.

## Receipts intentionally pending

- Managed hosted recovery, pending paid-plan cost approval
- Controlled Sentry receipt and alert acknowledgement
- Recent and older supported iPhone checks
- Complete critical workflow
- Public privacy/support access and monitored inboxes
- TestFlight build identity and installation
- Raymond's approval for this exact candidate

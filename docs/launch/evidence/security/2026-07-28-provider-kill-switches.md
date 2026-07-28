# Provider Kill-Switch and Draft-Only Authority Evidence

Date: 2026-07-28

Environment: guarded Mise hosted staging only

Backend checkpoint: `22c6e5b`

Proof-harness checkpoint: `07cd9ba`

## Boundary delivered

- Global and restaurant ordering policy is persisted as `off` or `draft_only`
  and defaults to `off`.
- Order drafting cannot be enabled unless the corresponding policy is
  `draft_only`.
- Every existing and newly created restaurant receives one default-off
  operational-control row.
- The supplier-email claim authenticates the owner, admin, or manager before
  revealing provider state.
- The claim requires normal system mode plus both global and restaurant Gmail
  delivery switches.
- The prior unguarded provider function is private and cannot be executed by
  `service_role`.
- Disabled or paused delivery returns `provider_not_enabled` before creating
  delivery evidence or changing a supplier order.
- The Edge Function maps the disabled state to HTTP 503 with instructions to
  copy or export the draft and send it outside Mise.

## Local evidence

- `npm run typecheck`: passed.
- `npm test`: 307 passed.
- `npm run security:backend`: passed.
- `npm run supabase:test`: 12 database suites and 547 pgTAP assertions passed;
  concurrent workspace quota proof passed; local security advisors reported
  no issues.
- `git diff --check`: passed.

## Hosted staging evidence

- Guarded preflight proved that the linked project was the dedicated staging
  project and not production.
- Dry run listed exactly
  `20260728203500_enforce_provider_kill_switches.sql`.
- That migration and the updated `send-supplier-email` function were deployed
  to staging only.
- `scripts/staging-provider-restrictions-check.mjs` passed:
  - one safe global control row;
  - one default-off control row for every staging restaurant;
  - zero enabled restaurant provider flags;
  - zero non-`off` restaurant ordering policies;
  - no service-role execute privilege on the unguarded claim;
  - an authoritative service-role claim returned `provider_not_enabled`;
  - the blocked claim created no private delivery row.
- Linked Supabase security advisors completed with no error-level findings.
  Existing warning-level findings concern intentional actor-guarded public
  RPCs, the staging identity probe, and hosted leaked-password protection;
  they were not introduced by this batch and remain visible for launch review.

## Launch boundary

Gmail delivery, Square, live AI, order drafting, and billing remain disabled in
staging and are outside the August 3 restaurant beta. No production migration,
function deployment, provider activation, push, merge, or release occurred.

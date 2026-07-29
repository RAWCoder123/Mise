# Mise Release Gate Status

Updated: 2026-07-28

| Gate | Status | Current evidence | Remaining blockers |
| --- | --- | --- | --- |
| 1. Private-beta foundation | In progress | Expo dependency repair, tenant security migrations, deterministic demo mode, team roles, hosted account-deletion proof, service-only restaurant provisioning, globally disabled public signup with invited-user email login preserved, protected owner invitation acceptance and sign-in, owner/admin restaurant export, complete hosted two-tenant and rendered race proof, scrubbed observability contracts, live PostHog staging receipt, operational restore evidence, incident runbooks, enforced read-only/emergency modes, fail-closed exact-commit release authority, pinned TestFlight tooling, organization-owned EAS project identity and preview runtime configuration, sanitized mobile upload boundary, localized signed-out/in-app privacy and support access, and reviewed/deployed owner-only public-web source | Apple signing authorization and validation, public internet access for the reviewed privacy/support pages, full Xcode, physical-iPhone invitation/device proof, monitored invitation delivery, live Sentry receipt and alerts, paid-plan managed hosted recovery, monitored support/privacy inboxes, internal TestFlight |
| 2. Inventory truth | Beta scope complete; device proof pending | Effective-dated mapping schema/domain rules, verified conversions, append-only ledger, event-derived on-hand projection, replay-safe RPC/outbox, count reconciliation, daily CSV import, mobile count/receipt/waste/stockout workflows, hosted learning proof, deterministic evidence-backed daily findings, exact append-only manager feedback, restart-safe feedback delivery, and localized operator UI including rendered export | Real-device inventory/offline/share walkthrough; package mappings remain fail-closed until verified |
| 3. Square shadow mode | Not started | Fail-closed POS adapter scaffold | OAuth, webhooks, backfill, reconciliation, shadow evidence |
| 4. Operational pilot | Not started | Default-off order safety evaluator, persisted `off`/`draft_only` policy, tenant/global provider gates, and manager-controlled email workflow | Scheduler, provider activation proof, pilot evidence |
| 5. Commercial and App Store launch | Not started | Paid-readiness and TestFlight checklists | Savings evidence, billing approval, privacy/deletion, App Store submission |

## Gate policy

A later gate may be developed behind disabled controls, but it cannot be activated
until every preceding gate has documented evidence and no unresolved P0 or P1 issue.

## Current beta evidence

- `npm run typecheck`
- `npm test`: 330 passed
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:interactions`: passed at 390x844 in English, Spanish, and
  Simplified Chinese
- `npm run supabase:test`: 566 pgTAP assertions, bounded concurrency proof,
  and no local security-advisor findings
- `npm run verify:private-beta-security:hosted`: passed without skipped checks
- `npm run staging:learning-check`: a bounded 30 lb recommendation learned the
  manager-approved 40 lb median without crossing tenants or sending an order
- Hosted account deletion deleted only its disposable tenant and left durable
  cleanup evidence.
- Hosted Auth rejects public signup with HTTP 422, preserves invited-user email
  login, disables anonymous admission, and reconciles to the repository-recorded
  staging configuration with no drift.
- Hosted owner invitation proof provisioned a disposable tenant, accepted one
  protected link, set and re-used the owner's sign-in credentials, replayed the
  service request without duplication, preserved the sentinel tenant, and
  removed all disposable state.
- Hosted tenant allocation is service-only and idempotent; authenticated users
  cannot call the legacy allocation RPC or enter setup without membership.
- The lifetime workspace quota is exercised directly through the service-only
  provisioning RPC: five allocations survive membership churn and a sixth
  service request is rejected.
- Hosted restaurant export returned 25 tenant-scoped datasets, denied manager
  and cross-tenant access, and excluded credentials and private security logs.
- Hosted finding feedback denied staff, direct-DML, cross-tenant, changed
  replay, and evidence-poisoning attempts while preserving one auditable
  manager decision.
- Exact manager feedback now affects only the matching finding evidence and
  policy, keeps handled findings visible in Later, and expires after evidence
  or the original recommendation changes.
- Manager feedback submission now survives app interruption and ambiguous
  transport with the original client and idempotency identities; conflicts and
  permission failures remain visible for reconciliation.
- Staging migrations confirmed through
  `20260728210609_enforce_invite_only_beta_admission.sql`
- Hosted provider proof confirms every staging tenant is default-off, the
  service role cannot bypass the guarded Gmail claim, and a blocked claim
  creates no delivery evidence.
- `npm run beta:go-no-go` is intentionally blocked until all 12 exact-commit
  receipts, a TestFlight build identity, and Raymond approval are recorded.
- Daily Brief, manager feedback, and owner/admin export UI passed static design
  checks plus rendered English, Spanish, and Simplified Chinese interaction QA.
- Privacy and support are available before sign-in and from Settings, use
  independently accessible 44px links, and expose only bounded public mail and
  policy destinations. Public hosting and inbox monitoring remain external.
- `/settings/export` now passes shell and 390x844 rendered coverage. The EAS
  preflight correctly blocks on missing login and project identity.
- `/accept-invite` now passes shell and localized 390x844 rendered coverage with
  zero horizontal overflow.
- The complete hosted security closure passes after the invite-only UI update,
  including all seven rendered tenant workspace-switch and mutation races.
- The refreshed isolated staging restore matched 46 operational tables and 746
  rows in 23.2 seconds without emitting row content; managed hosted recovery
  remains a separate receipt.

Remaining external verification:

- Install and walk the critical workflow on real supported iPhones.
- Complete the Raymond-controlled Apple account authorization so EAS can
  generate and validate the App Store distribution certificate and
  provisioning profile for the dedicated `testflight` profile.
- The former ad hoc Preview command has been corrected: TestFlight now resolves
  to App Store distribution with staging runtime configuration and deterministic
  reviewer demo access.
- Enable public hosting for the reviewed privacy/support site or connect the
  exact source to `getmise.app`; the current Sites workspace rejects public
  access and both `getmise.app` routes time out.
- Install full Xcode so `simctl` and native release checks are available.
- Confirm monitored support/privacy inboxes.
- Accept a release-candidate owner invitation on a physical iPhone and confirm
  the monitored invitation-delivery channel.
- Complete live monitoring, managed Supabase recovery, and TestFlight evidence.
- PostHog now has one live, scrubbed staging receipt. Sentry and provider alert
  delivery remain pending.
- Managed Supabase recovery requires a paid plan and a cost-approved recovery
  project; the Free organization cannot provide that receipt.

# August 3 Restaurant Beta — Owner Actions

Target: invite-only iOS TestFlight beta on August 3, 2026 for one restaurant,
then a second restaurant after one healthy operating day.

This is not a public App Store launch. Square, Gmail delivery, generative AI,
billing, autonomous ordering, and in-app supplier sending remain disabled.
Managers review and copy or export supplier drafts, then communicate through
their existing channels outside Mise.

## External access required before the release candidate

- [ ] Confirm the active Apple Developer Program membership.
- [ ] Confirm the App Store Connect app for `com.mise.mobile`.
- [ ] Confirm Expo/EAS account and project access with `npx eas whoami`.
- [ ] Configure dedicated staging and production Supabase projects. Do not
  deploy or promote production until the recorded go/no-go is approved.
- [ ] Configure Sentry and PostHog beta projects with scrubbed,
  environment-specific public client credentials.
- [ ] Publish monitored privacy-policy and support URLs.
- [ ] Identify one recent and one older supported iPhone for verification.
- [ ] Confirm one initial restaurant and one held-back restaurant, each with a
  named owner and manager.

## Required evidence

Record receipts in `docs/launch/BETA_RELEASE_EVIDENCE.json`. Each passed check
must name its owner, exact candidate commit, verification time, and durable
evidence reference.

- [ ] Complete local release gate.
- [ ] Complete hosted security suite.
- [ ] Complete two-tenant negative proof.
- [ ] Restore a managed backup into an isolated recovery environment.
- [ ] Receive a controlled scrubbed Sentry event.
- [ ] Receive a controlled scrubbed PostHog event.
- [ ] Pass the real-device walkthrough on both iPhones.
- [ ] Pass the complete critical workflow walkthrough.
- [ ] Verify monitored privacy and support URLs.
- [ ] Install the exact candidate build through TestFlight.
- [ ] Verify prohibited providers and supplier delivery remain disabled.
- [ ] Record no unresolved P0/P1 defects.
- [ ] Record Raymond’s approval for the exact candidate commit.

Run:

```bash
npm run beta:go-no-go
```

The command must remain blocked until every receipt and exact-commit approval is
present. A date, successful build, or partial checklist never opens the beta.

## August 3 admission

1. Admit only the first restaurant.
2. Observe authentication, ingestion, findings, inventory reconciliation,
   offline recovery, and tenant-denial telemetry through one operating day.
3. Stop admission for any P0/P1 issue, tenant ambiguity, missing authoritative
   evidence, or inability to restore service safely.
4. Admit the second restaurant only after the first-day evidence is reviewed.

## Explicitly deferred

- Public App Store distribution
- Square production sync
- Gmail or any in-app supplier delivery
- Stripe or savings-share billing
- Generative AI findings
- Autonomous supplier ordering
- Android and non-US support

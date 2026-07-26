# Mise Launch Ledger

This ledger is the durable handoff between Codex and Cursor. Each batch must have
exclusive ownership, test evidence, unresolved findings, and a local checkpoint
commit before another batch begins.

## Operating rules

- Cursor owns Expo screens, navigation, visual design, accessibility, localization,
  interaction design, and real-device UI verification unless a batch says otherwise.
- Codex owns domain logic, service contracts, repositories, Supabase, integrations,
  billing evidence, security, and backend tests unless a batch says otherwise.
- Only one agent may edit a shared or locked file at a time.
- An agent must update `CURRENT_BATCH.yaml` before changing ownership.
- A batch cannot close with an unrecorded P0 or P1 finding.
- Local checkpoint commits are allowed. Pushes, merges, releases, and production
  deployments require Raymond's explicit approval.

## Batches

| Batch | Owner | Goal | Status | Checkpoint |
| --- | --- | --- | --- | --- |
| `operational-data-foundation-01` | Codex | Tenant-safe operational mappings and append-only inventory events | Complete | `dbe0cc4` |
| `private-beta-account-inventory-replay-02` | Tandem | Account controls plus replay-safe inventory reconciliation | Complete | Pending |

### `private-beta-account-inventory-replay-02`

In scope:

- Codex: deterministic offline inventory outbox transitions, retry policy,
  authoritative deduplication, conflict surfacing, count reconciliation, and
  domain tests.
- Cursor: account deletion, restaurant team directory, invitations, session
  UX, and the related repository contracts.

Stop conditions:

- A retry changes `client_event_id` or `idempotency_key`.
- A conflict is silently retried or overwritten.
- Reconciliation mixes restaurants or inventory items.
- Account deletion bypasses the standard firewall, authorization, or audit
  lifecycle.

Delivered:

- Self-serve sign-up, account-deletion initiation, restaurant team directory,
  role controls, and localized settings UI.
- Recoverable two-phase account deletion: durable plan, Auth deletion, then
  service-retryable tenant cleanup by audit ID.
- Ownership-safe deletion candidates that preserve a restaurant when another
  active owner remains or is added after planning.
- Append-only inventory actor anonymization during Auth deletion without
  allowing direct event updates or deletes.
- A durable tenant-scoped device outbox, bounded retries, server
  deduplication, terminal conflict surfacing, and count reconciliation.

Evidence:

- `npm run typecheck`
- `npm test`: 216 passed
- `npm run security:backend`
- `npm run supabase:test`: 464 pgTAP assertions, concurrency proof, and no
  local security-advisor findings

Remaining external verification:

- Hosted-staging account deletion and tenant proof
- Real-device sign-up, team, deletion, and offline-replay walkthrough

### `operational-data-foundation-01`

Delivered:

- Canonical grams, milliliters, and each conversion with verified pack and
  density rules.
- Effective-dated POS, menu, recipe, ingredient, modifier, substitution, and
  supplier mapping contracts.
- Sales-volume mapping coverage gates at 90% for shadow mode and 95% for
  operational drafting.
- Global and restaurant-level provider kill switches.
- Append-only, tenant-safe inventory events with manager RPC authority,
  idempotent offline replay, correction links, immutable history, and audit
  evidence.

Evidence:

- TypeScript passed on the isolated Codex batch.
- 188 application/domain tests passed in the combined worktree.
- 439 local pgTAP tests passed after a clean migration rebuild.
- Supabase security advisors reported no issues.

Cross-batch findings handed to Cursor:

- The in-progress team-directory repository imports currently block combined
  worktree typechecking.
- The in-progress delete-account Edge Function still needs the standard
  firewall reservation before combined backend security checks can pass.

## Handoff format

Every completed batch records:

1. The exact paths changed.
2. Commands run and their results.
3. External verification that remains outstanding.
4. Known non-blocking findings.
5. The local checkpoint commit.

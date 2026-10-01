# Membershipless account deletion (2026-08-27)

## Completed

Signed-in users with **zero active restaurant memberships** can delete their Auth
account from the Setup pending-access screen. Restaurant-scoped deletion is
unchanged for members.

### Implemented

- Additive migration `20260827090000_membershipless_account_deletion.sql`
  - `service_plan_account_deletion` accepts null restaurant only when active
    membership count is zero; plans empty restaurant candidates
  - User-scoped firewall RPCs:
    `service_reserve_membershipless_account_deletion` /
    `service_record_membershipless_account_deletion_event`
- `delete-account` Edge: optional `restaurantId`; membershipless branch
- Client `deleteAccount(restaurantId?: string | null)`
- Setup pending UI with DELETE confirmation (EN/ES/ZH)
- security-backend allowlist for new service RPCs
- Static + pgTAP coverage extended

### Security invariants

- Active membership still forces restaurant-scoped path
- Membershipless path never plans or deletes restaurants
- Durable `account_deletion_audit` records `membershipless: true`
- Service-role only for plan/reserve/record RPCs

## Verification

- `npm run typecheck` — passed
- `node --test tests/accountDeletionMigration.test.ts tests/accountDeletionCandidateCleanup.test.ts` — 9/9
- `npm run security:backend` — passed
- `npm test` — see commit notes
- Hosted/Docker pgTAP — not executed in this environment

## Not done / blocked

- Deploy additive migration to staging
- Physical device confirmation of Setup pending delete UX
- Open stacks #130–#202 remain separate; this tip does not overlap them

## Next

1. Prefer landing/rebasing open readiness/learning stacks without duplicating
2. Optional: surface membershipless delete from a dedicated account-only route
   if Setup copy remains confusing for invite-pending users

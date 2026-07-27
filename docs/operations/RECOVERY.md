# Mise Beta Recovery

Owner: Raymond Wong

Backup owner: must be named before the first restaurant is admitted

Provisional beta targets: 24-hour RPO and 4-hour RTO. These are operational
targets, not contractual guarantees, until the hosted Supabase backup schedule
and managed recovery exercise are recorded.

## What is proven

`npm run recovery:staging-check`:

1. Verifies the configured project is the dedicated non-production staging
   project before transmitting its database password.
2. Creates a logical custom-format dump of `public` and `private` over required
   TLS.
3. Creates an ephemeral loopback-only PostgreSQL cluster in an operating-system
   temporary directory.
4. Restores the operational schemas with no owner or ACL carryover.
5. Compares every table using both row count and deterministic UTC-normalized
   content digest.
6. Emits only counts, timing, size, and artifact digest.
7. Stops and removes the ephemeral cluster and dump.

The July 27 proof restored and matched 43 tables and 474 rows in 22 seconds.
Its durable, content-free evidence is in
`docs/launch/evidence/recovery/2026-07-27-staging-restore.json`.

## What is not proven

- Supabase Auth identities, sessions, MFA, Storage objects, Vault secrets, Edge
  secrets, provider OAuth credentials, or project configuration.
- Point-in-time recovery in a hosted recovery project.
- Production restoration.

The local proof creates UUID-only Auth stubs solely so operational foreign keys
can be validated. It does not claim that users can authenticate to the restored
database.

## Hosted recovery exercise

Before public production:

1. Raymond creates or designates an empty recovery-only Supabase project.
2. Record its project reference in a local secret store as
   `SUPABASE_RECOVERY_PROJECT_REF`; it must differ from staging and production.
3. Export managed Auth/Storage/project configuration using the current Supabase
   recovery procedure in addition to the Mise operational dump.
4. Restore into the recovery project, never staging or production.
5. Run schema/table counts, tenant-negative tests, inventory-history checks,
   account-deletion checks, and a review-account sign-in.
6. Record start/end time, backup point, RPO, RTO, object counts, checksums,
   operator, and cleanup decision without row content or credentials.
7. Destroy or lock the recovery project after evidence review.

No production promotion is permitted merely because the local operational
restore passes.

## Recovery decision

- Enter `read_only` for suspected data corruption and `emergency` for possible
  tenant exposure.
- Preserve current logs and a new logical snapshot before repair.
- Prefer replaying idempotent inventory/CSV events over editing projections.
- Never update or delete inventory history to make a checksum pass.
- Admit writes only after tenant isolation, event projection, account
  deletion, and critical mobile workflows pass against the recovered state.

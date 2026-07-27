# Mise Private-Beta Incident Response

Incident commander: Raymond Wong

Backup incident commander and customer-communications owner: must be named
before the first restaurant is admitted.

## Severity

- P0: suspected cross-tenant exposure, unauthorized supplier action, corrupted
  authoritative inventory history, or loss of control over production access.
- P1: one restaurant cannot complete a critical workflow, findings are
  materially unsafe, restoration is required, or a provider repeatedly
  corrupts/replays work.
- P2: degraded workflow with a documented safe workaround.

No beta opens with an unresolved P0 or P1.

## First ten minutes

1. Record time, reporter, environment, release, operation ID, and request ID.
2. Do not copy restaurant-entered content, credentials, or raw request bodies
   into tickets or chat.
3. Set the narrowest safe kill switch. Use `integrations_paused` for provider
   malfunction, `read_only` for suspected corruption, and `emergency` for
   possible tenant exposure.
4. Disable order drafting, Gmail delivery, Square, AI insights, and billing
   independently when their scope is implicated.
5. Preserve append-only events, decisions, provider references, and audit
   evidence.
6. Notify the backup incident owner and affected restaurant contact using the
   monitored support process.

## Tenant exposure

- Enter `emergency`; revoke the implicated session/membership and provider
  credentials.
- Preserve the exact denied/allowed request IDs and release.
- Run the hosted two-tenant negative suite before any reopening.
- Determine affected tenants from authoritative audit data; never infer scope
  from UI caches.
- Raymond alone approves return to `read_only`, then `normal`.

## Provider malfunction

- Enter `integrations_paused` or disable the affected global and
  restaurant-level switch.
- Stop retries that could duplicate a supplier action.
- Reconcile provider event IDs and Mise idempotency keys.
- Core manual inventory, CSV, findings, and draft-copy workflows remain
  available unless `read_only` is also required.

## Bad recommendation

- Disable order drafting and insight generation for the restaurant.
- Preserve the original finding, evidence window, policy version, manager
  decision, and edited quantity.
- Correct source mappings/counts with new authoritative evidence; never rewrite
  the original recommendation or inventory event.
- Re-run deterministic findings in staging before re-enabling.

## Data restoration

- Enter `read_only`.
- Follow `docs/operations/RECOVERY.md`.
- Restore into isolation first and compare all operational tables.
- Validate tenant boundaries, account deletion, immutable inventory, and the
  critical device walkthrough before controlled cutover.

## Closure

Record root cause, affected scope, evidence IDs, mitigation, restoration point,
RPO/RTO, customer communication, follow-up owner, and the tests required to
prevent recurrence. A P0/P1 closes only after Raymond reviews this record.

# Recalculation machine runner (2026-10-08)

## Why

Section 26 recalculation cycles already decide due/backoff/dead-letter work, and
member sessions can record attempts, but a restaurant nobody opened received no
refresh. Pilot gap audit called for an authorized machine runner before
unattended operation.

## What landed

- Additive migration `20261008140000_recalculation_machine_runner.sql`
  - `recorded_source` (`member` | `machine`) with fail-closed actor pairing
  - `service_list_recalculation_runner_targets`
  - `service_resolve_recalculation_signal_actor`
  - `service_record_machine_recalculation_run` (service_role only)
- Edge Function `run-scheduled-recalculations` authenticated by
  `MISE_RECALCULATION_RUNNER_SECRET` / `x-mise-recalculation-secret`
- Shared application pass `runMachineRecalculationPass`
- Security allowlists for the global service-only RPCs and non-tenant Edge auth

Signal refresh still uses an active owner/admin/manager through the mature
actor-bound planning RPCs. Machine ledger rows never invent a human
`recorded_by`.

## Hosted follow-up (external)

Store the runner secret and project URL in Vault, then schedule:

```sql
select cron.schedule(
  'mise-recalculation-runner-every-15-minutes',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'mise_project_url')
      || '/functions/v1/run-scheduled-recalculations',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-mise-recalculation-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'mise_recalculation_runner_secret')
    ),
    body := '{"action":"run","maxRestaurants":25}'::jsonb
  );
  $$
);
```

## Verification

- `npm run typecheck`
- focused: `recalculationMachineRunner`, `recalculationMachineRunnerMigration`
- `npm run security:static`
- `npm run security:backend`
- `npm test`

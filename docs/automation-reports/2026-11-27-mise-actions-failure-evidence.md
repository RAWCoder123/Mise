# Mise-action failure evidence INSERT tip (2026-11-27)

## Gap

`mise_actions.error_code` and `error_message` are nullable because non-failure
statuses legitimately leave them null. Hosted
`private.service_record_mise_action_failure` already rejects failure recording
without a slug `error_code` and a non-empty `error_message` when advancing an
action to `failed` or `unverified` via UPDATE, but direct inserts can still mint
a terminal failure claim with both fields null — a failure Activity / audit
analysis cannot explain.

## Change

- Domain: `validateMiseActionsFailureEvidence` → `missing_error_code` /
  `missing_error_message`
- Additive BEFORE INSERT tip only on `public.mise_actions`
- No NOT NULL / status-implies-error CHECK (preserves non-failure rows)
- Does not rewrite `decide_mise_action` or `service_record_mise_action_failure`
- pgTAP plan = 7 (derived from assertion call sites)

## Alone-OK

Orthogonal to mise_actions executed_at tip (#1304), decision-actor tip (#1298),
locale / ASCII-C pins (including error_code / error_message cntrl pins), and
inventory / count-session / purchase-line / autonomy / audit / activity actor
tips. Does not invent unconditional table-level NOT NULL. Does not require
failure evidence on pre-failure or `executed` inserts. When stacking with
#1304, that tip's unmerged `failed`-without-errors fixture needs error stamps.

## Verification

- `npm run typecheck`
- focused `miseActionsFailureEvidence` suite
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- Docker `npm run supabase:test` when available

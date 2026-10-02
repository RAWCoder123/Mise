# MISE-005FT: audit_logs.entity_table cntrl locale pin

## Summary

Additive CHECK-only migration attaches `audit_logs_entity_table_check` as
`length(trim(entity_table)) between 1 and 120` plus
`entity_table collate "C" !~ '[[:cntrl:]]'`.

The backbone column was NOT NULL text with no CHECK. The edge writer
`private.service_record_edge_audit_log` already rejects entity_table
values whose length is outside 1..120; this tip locks that bound at the
table and closes LC_CTYPE dump/restore drift for durable single-line
table-name labels.

## Scope

- CHECK-only; does not rewrite `service_record_edge_audit_log` or other
  SECURITY DEFINER audit insert paths
- Leaves `action` (#583), `entity_id` (uuid), and `metadata` untouched
- Does not expand to a charset allowlist (cntrl-only)
- Does not overlap sales_imports.error_message (#582) or activity /
  mise_actions error_message tips

## Verification

- `npm run typecheck` — passed
- focused `auditLogsEntityTableCntrlLocalePin` — 4/4 passed
- `npm test` — 680 passed, 0 failed, 7 cancelled (withTimeout baseline)
- pgTAP plan **12** from 12 assertion call sites (Docker unavailable)

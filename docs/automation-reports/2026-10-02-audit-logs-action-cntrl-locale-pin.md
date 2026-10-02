# MISE-005FS: audit_logs.action cntrl locale pin

## Summary

Additive CHECK-only migration attaches `audit_logs_action_check` as
`length(trim(action)) between 1 and 120` plus
`action collate "C" !~ '[[:cntrl:]]'`.

The backbone column was NOT NULL text with no CHECK. The edge writer
`private.service_record_edge_audit_log` already rejects actions whose
length is outside 1..120; this tip locks that bound at the table and
closes LC_CTYPE dump/restore drift for durable single-line audit verbs.

## Scope

- CHECK-only; does not rewrite `service_record_edge_audit_log` or other
  SECURITY DEFINER audit insert paths
- Leaves `entity_table`, `entity_id` (uuid), and `metadata` untouched
- Does not expand to a charset allowlist (cntrl-only)
- Does not overlap sales_imports.error_message (#582) or activity /
  mise_actions error_message tips

## Verification

- `npm run typecheck`
- focused `auditLogsActionCntrlLocalePin`
- `npm test`
- pgTAP plan derived from assertion call sites (Docker may be unavailable)

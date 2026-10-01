# MISE-005EH: finding severity locale pin

**Date:** 2026-10-01  
**Branch:** `cursor/mise-finding-severity-locale-pin`  
**Base:** `origin/main` @ `78da737` (+ open locale-pin stacks through #545)

## Change

Additive CHECK-only migration
`20261001120000_mise_005eh_finding_severity_locale_pin.sql`
replaces `operational_finding_decisions_severity_check` so the exact
allowlist `info` / `warning` / `urgent` is also gated by ASCII shape under
`COLLATE "C"`:

```sql
severity in (
  'info',
  'warning',
  'urgent'
)
and severity collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Why

The bare IN check from `append_operational_finding_decisions` is exact string
equality with no dedicated C-locale ASCII shape gate. MISE-005A proved locale
drift on this cluster; open tip #537 pinned `decision_type` and open tip #545
pinned `finding_category` on the same table but left `severity` unpinned.
Dump/restore under a drifted `LC_CTYPE` could accept bytes a restored C-locale
path would refuse (or the reverse), breaking finding-decision evidence
continuity.

## Scope / non-goals

- Does **not** rewrite `public.record_operational_finding_decision`
- Does **not** touch `operational_finding_decision_edit_check`,
  `decision_type` (#537), `finding_category` (#545), `finding_id` (#442),
  `policy_version` (#440), `client_event_id` / `idempotency_key` (#454),
  `insights.severity` (#515), `operational_issues.severity` (#508), or
  `purchase_decision_events`
- CHECK-only; no policy or function changes

## Verification

- `npm run typecheck`
- Focused `findingSeverityLocalePin` tests
- `npm test` (expect 0 fail; cancelledByParent noise allowed)
- pgTAP plan **11** counted from 11 assertion call sites in
  `finding_severity_locale_pin.test.sql` (Docker pgTAP not required in this
  environment)

## Classification impact

No change to release classification. Continues the controlled-pilot vocabulary
hardening cluster; does not unlock App Store submission.

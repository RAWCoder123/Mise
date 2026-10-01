# MISE-005DY: finding decision_type locale pin

**Date:** 2026-10-01  
**Branch:** `cursor/mise-finding-decision-type-locale-pin`  
**Base:** `origin/main` @ `78da737` (+ open locale-pin stacks through #536)

## Change

Additive CHECK-only migration
`20261001030000_mise_005dy_finding_decision_type_locale_pin.sql`
replaces `operational_finding_decisions_decision_type_check` so the exact
allowlist `approved` / `edited` / `dismissed` is also gated by ASCII shape
under `COLLATE "C"`:

```sql
decision_type in ('approved', 'edited', 'dismissed')
and decision_type collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Why

The bare IN check from `append_operational_finding_decisions` is exact string
equality with no dedicated C-locale ASCII shape gate. MISE-005A proved locale
drift on this cluster; open tip #454 pinned client identity keys on the same
table but left `decision_type` unpinned. Dump/restore under a drifted
`LC_CTYPE` could accept bytes a restored C-locale path would refuse (or the
reverse), breaking finding-decision evidence continuity.

## Scope / non-goals

- Does **not** rewrite `public.record_operational_finding_decision`
- Does **not** touch `operational_finding_decision_edit_check`,
  `finding_id` (#442), `policy_version` (#440),
  `client_event_id` / `idempotency_key` (#454), `finding_category`,
  `severity`, or `purchase_decision_events.decision_type`
- CHECK-only; no policy or function changes

## Verification

- `npm run typecheck`
- Focused `findingDecisionTypeLocalePin` tests
- `npm test` (expect 0 fail; cancelledByParent noise allowed)
- pgTAP plan **11** counted from 11 assertion call sites in
  `finding_decision_type_locale_pin.test.sql` (Docker pgTAP not required in this
  environment)

## Classification impact

No change to release classification. Continues the controlled-pilot vocabulary
hardening cluster; does not unlock App Store submission.

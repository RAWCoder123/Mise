# MISE-005EG: finding finding_category locale pin

**Date:** 2026-10-01  
**Branch:** `cursor/mise-finding-category-locale-pin`  
**Base:** `origin/main` @ `78da737` (+ open locale-pin stacks through #544)

## Change

Additive CHECK-only migration
`20261001110000_mise_005eg_finding_category_locale_pin.sql`
replaces `operational_finding_decisions_finding_category_check` so the exact
allowlist `inventory` / `ordering` / `sales` / `waste` / `prep` / `cost` /
`data_quality` is also gated by ASCII shape under `COLLATE "C"`:

```sql
finding_category in (
  'inventory', 'ordering', 'sales', 'waste',
  'prep', 'cost', 'data_quality'
)
and finding_category collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Why

The bare IN check from `append_operational_finding_decisions` is exact string
equality with no dedicated C-locale ASCII shape gate. MISE-005A proved locale
drift on this cluster; open tip #537 pinned `decision_type` on the same table
but left `finding_category` unpinned. Dump/restore under a drifted `LC_CTYPE`
could accept bytes a restored C-locale path would refuse (or the reverse),
breaking finding-decision evidence continuity.

## Scope / non-goals

- Does **not** rewrite `public.record_operational_finding_decision`
- Does **not** touch `operational_finding_decision_edit_check`,
  `decision_type` (#537), `finding_id` (#442), `policy_version` (#440),
  `client_event_id` / `idempotency_key` (#454), `severity`, or
  `purchase_decision_events`
- CHECK-only; no policy or function changes

## Verification

- `npm run typecheck`
- Focused `findingCategoryLocalePin` tests
- `npm test` (expect 0 fail; cancelledByParent noise allowed)
- pgTAP plan **15** counted from 15 assertion call sites in
  `finding_category_locale_pin.test.sql` (Docker pgTAP not required in this
  environment)

## Classification impact

No change to release classification. Continues the controlled-pilot vocabulary
hardening cluster; does not unlock App Store submission.

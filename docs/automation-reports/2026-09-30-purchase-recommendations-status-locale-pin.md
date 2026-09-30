# MISE-005DV: purchase_recommendations.status locale pin

**Date:** 2026-09-30  
**Branch:** `cursor/mise-purchase-recommendations-status-locale-pin`  
**Base:** `origin/main` @ `78da737` (+ open locale-pin stacks through #533)

## Change

Additive CHECK-only migration
`20260930360000_mise_005dv_purchase_recommendations_status_locale_pin.sql`
replaces `purchase_recommendations_status_check` so the exact allowlist
`pending` / `approved` / `dismissed` / `ordered` is also gated by ASCII shape
under `COLLATE "C"`:

```sql
status in ('pending', 'approved', 'dismissed', 'ordered')
and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Why

The bare IN check from `secure_multi_tenant_rls` is exact string equality with
no dedicated C-locale ASCII shape gate. MISE-005A proved locale drift on this
cluster; sibling pins through #533 left `purchase_recommendations.status`
unpinned. Dump/restore under a drifted `LC_CTYPE` could accept bytes a restored
C-locale path would refuse (or the reverse), breaking purchase-recommendation
continuity.

## Scope / non-goals

- Does **not** rewrite approve / dismiss / undo / replace-pending RPCs
- Does **not** touch `generation_source`, `urgency`, `purchase_orders.status`
  (#519), or `purchase_decision_events`
- CHECK-only; no policy or function changes

## Verification

- `npm run typecheck`
- Focused `purchaseRecommendationsStatusLocalePin` tests
- `npm test` (expect 0 fail; cancelledByParent noise allowed)
- pgTAP plan **12** counted from 12 assertion call sites in
  `purchase_recommendations_status_locale_pin.test.sql` (Docker pgTAP not
  required in this environment)

## Classification impact

No change to release classification. Continues the controlled-pilot vocabulary
hardening cluster; does not unlock App Store submission.

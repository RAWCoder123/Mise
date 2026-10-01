# MISE-005DW: purchase_recommendations.urgency locale pin

**Date:** 2026-10-01  
**Branch:** `cursor/mise-purchase-recommendations-urgency-locale-pin`  
**Base:** `origin/main` @ `78da737` (+ open locale-pin stacks through #534)

## Change

Additive CHECK-only migration
`20261001010000_mise_005dw_purchase_recommendations_urgency_locale_pin.sql`
replaces `purchase_recommendations_urgency_check` so the exact allowlist
`low` / `medium` / `high` is also gated by ASCII shape under `COLLATE "C"`:

```sql
urgency in ('low', 'medium', 'high')
and urgency collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Why

The bare IN check from `secure_multi_tenant_rls` is exact string equality with
no dedicated C-locale ASCII shape gate. MISE-005A proved locale drift on this
cluster; sibling pins through #534 left `purchase_recommendations.urgency`
unpinned. Dump/restore under a drifted `LC_CTYPE` could accept bytes a restored
C-locale path would refuse (or the reverse), breaking purchase-recommendation
continuity.

## Scope / non-goals

- Does **not** rewrite approve / dismiss / undo / replace-pending RPCs
- Does **not** touch `generation_source`, `status` (#534), `purchase_orders.status`
  (#519), or `purchase_decision_events`
- CHECK-only; no policy or function changes

## Verification

- `npm run typecheck`
- Focused `purchaseRecommendationsUrgencyLocalePin` tests
- `npm test` (expect 0 fail; cancelledByParent noise allowed)
- pgTAP plan **11** counted from 11 assertion call sites in
  `purchase_recommendations_urgency_locale_pin.test.sql` (Docker pgTAP not
  required in this environment)

## Classification impact

No change to release classification. Continues the controlled-pilot vocabulary
hardening cluster; does not unlock App Store submission.

# MISE-005EA: purchase_decision_events.recommendation_source locale pin

**Date:** 2026-10-01  
**Branch:** `cursor/mise-purchase-decision-recommendation-source-locale-pin`  
**Base:** `origin/main` @ `78da737` (+ open locale-pin stacks through #538)

## Change

Additive CHECK-only migration
`20261001050000_mise_005ea_purchase_decision_recommendation_source_locale_pin.sql`
replaces `purchase_decision_events_recommendation_source_check` so the exact
allowlist `mise_rules` / `legacy_client` is also gated by ASCII shape under
`COLLATE "C"`:

```sql
recommendation_source in ('mise_rules', 'legacy_client')
and recommendation_source collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Why

The bare IN check from MISE-004A is exact string equality with no dedicated
C-locale ASCII shape gate. MISE-005A proved locale drift on this cluster; open
tip #538 pinned `actor_role` / `decision_type` on the same table but left
`recommendation_source` unpinned. Dump/restore under a drifted `LC_CTYPE` could
accept bytes a restored C-locale path would refuse (or the reverse), breaking
purchase-decision pattern continuity.

## Scope / non-goals

- Does **not** rewrite `record_purchase_decision_*` writers
- Does **not** touch `actor_role` / `decision_type` (#538), `source_event_key`
  (#451), `evidence_version` (#482), `canonical_unit` (#490/#491), or
  `purchase_recommendations.generation_source` (#484)
- CHECK-only; no policy or function changes

## Verification

- `npm run typecheck`
- Focused `purchaseDecisionRecommendationSourceLocalePin` tests
- `npm test` (expect 0 fail; cancelledByParent noise allowed)
- pgTAP plan **10** counted from 10 assertion call sites in
  `purchase_decision_recommendation_source_locale_pin.test.sql` (Docker pgTAP
  not required in this environment)

## Classification impact

No change to release classification. Continues the controlled-pilot vocabulary
hardening cluster; does not unlock App Store submission.

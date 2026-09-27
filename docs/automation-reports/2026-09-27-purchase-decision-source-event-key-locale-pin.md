# MISE-005AQ: pin purchase_decision source_event_key CHECK to COLLATE C

**Date:** 2026-09-27  
**Branch:** `cursor/mise-purchase-decision-source-event-key-locale-pin`  
**Base:** `origin/main` @ `78da737`

## Summary

Replace the length-only CHECK on `public.purchase_decision_events.source_event_key` with a named ASCII shape gate under `COLLATE "C"`:

```sql
source_event_key collate "C" ~ '^[A-Za-z0-9:_-]{8,200}$'
```

## Why

`source_event_key` is the durable per-restaurant unique idempotency key for append-only purchase-decision evidence (`UNIQUE (restaurant_id, source_event_key)`). Writers mint ASCII tokens (`audit_log:` + UUID, `purchase_decision_exclusion:` + UUID). Length-only bounds accept spaces, control bytes, and non-ASCII that can diverge under `LC_CTYPE` drift on dump/restore — breaking evidence continuity after MISE-005A proved locale drift on this cluster.

## Scope

- CHECK-only on `purchase_decision_events_source_event_key_check`
- Does **not** rewrite `private.record_purchase_decision_base_event` / compensation writers
- Does **not** touch recommendation_unit cntrl (#416), purchase_lines currency (#446), or purchase-line writers (#397/#398/#414/#415)

## Compose

Alone on main OK. Timestamp after MISE-005AP (#450).

## Verification

- `npm run typecheck` — passed
- focused `tests/purchaseDecisionSourceEventKeyLocalePin.test.ts` — 3/3 passed
- `npm test` — 679 passed / 0 failed / 7 cancelled (withTimeout baseline)
- pgTAP fixture committed; Docker/hosted pgTAP not executed in this environment

## Files

- `supabase/migrations/20260927140000_mise_005aq_purchase_decision_source_event_key_locale_pin.sql`
- `supabase/tests/database/purchase_decision_source_event_key_locale_pin.test.sql`
- `tests/purchaseDecisionSourceEventKeyLocalePin.test.ts`
- `docs/automation-reports/2026-09-27-purchase-decision-source-event-key-locale-pin.md`

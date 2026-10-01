# Chronic short-ship advisory from delivery fill rates

Date: 2026-08-27  
Branch: `cursor/mise-chronic-short-ship-advisory`  
Baseline: `origin/main` @ `20b28e5`

## Summary

Mise now learns a bounded short-ship bias from authoritative
`supplier_delivery_items` evidence and pads low-stock recommendation quantities
when recent receives chronically underfill. Hosted planning snapshots expose
`receivingHistory`; demo/client planning parity reads the same delivery ledger.
Today and Insight presentation codes disclose the pattern in EN/ES/ZH.

## Changes

- Domain: `services/domain/receiveDiscrepancyLearning.ts`
- Signals: `services/domain/operationalSignals.ts`, `services/domain/miseDomain.ts`
- Snapshot: `supabase/migrations/20260827070000_receive_discrepancy_short_ship_learning.sql`
- Planning: repository `PlanningData.receivingHistory` + demo/hosted fetch paths
- Today/presentation: chronic short-ship task + insight codes

## Non-goals

- Does not change approve/dismiss/send authority
- Does not suppress recommendations from dismissals
- Does not invent ordered/received quantities
- Does not duplicate open stacks #130–#200 (004B patterns remain independent)

## Verification

- `npm run typecheck`
- Targeted short-ship / presentation tests
- `npm test`
- `npm run security:backend`

## Follow-up

- Rebase note for #200: include both `purchaseDecisionPatterns` and `receivingHistory` on the snapshot
- After #193/#194 land: optional purchase-loop variance → same bounded multiplier stack

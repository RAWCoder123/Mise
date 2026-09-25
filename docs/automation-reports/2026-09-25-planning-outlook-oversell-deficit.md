# Preserve POS oversell deficits in planning projections

Date: 2026-09-25
Base: `origin/main` @ `78da737`
Branch: `cursor/mise-planning-outlook-oversell-deficit`

## Problem

Planning outlook, operational signals, and authoritative on-hand projection
silently floored `projectedQuantity` with `Math.max(0, …)`. When mapped POS
depletion exceeded counted on-hand, operators saw `0` instead of the deficit,
and restore-to-par recommendations understated order quantity by that shortfall.

Demo chicken (18 on hand − 21 depletion) previously reported projected `0` and
suggested order `60` (par). Honest arithmetic is projected `-3` and order `63`.

## Change

- `services/domain/miseDomain.ts`: keep signed projected quantity; add oversell
  coverage/why copy.
- `services/domain/operationalSignals.ts`: same for recalculation stock-risk
  recommendations and insight descriptions.
- `services/domain/inventoryCountAuthority.ts`: same for
  `projectAuthoritativeOnHand`.
- `i18n/catalog.ts` + `i18n/inventoryPresentation.ts`: EN/ES/ZH oversold coverage
  and why keys.
- Tests assert chicken oversell, isolated prediction/signals/authority deficits,
  and purchase-memory demo picks a verified-canonical recommendation (ranking
  now correctly surfaces deeper oversell first, including draft-unit items).

## Verification

- `npm run typecheck` — pass
- `npm test` — 679 pass / 0 fail / 7 cancelled (pre-existing timeout parent
  cancellations in recalculation cycle tests)
- Focused: miseDomain, authoritativeInventoryCount, algorithmBoundaries,
  demoPurchaseDecisionMemory

## Not in scope

- Write-path on-hand floor (`inventoryOnHandGuard`) — blocked on open #383+#365+#348
- DB waste/stockout reason allowlists — blocked on #301+#366
- Landing open stacks #348–#408
- Inventing MOQ/lead_time/expiration

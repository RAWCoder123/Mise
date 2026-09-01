# Ask Mise stock Watch + POS sales grounding (2026-09-01)

## Summary

Ask Mise no longer claims stock is service-ready when only Watch inventory remains, and sales answers fail closed while POS connect/repair tasks are open.

## Behavior

### Stock Watch refuse service-ready
- `inventoryHealth.watch` is now reasoned over (optional for older fixtures; missing treats as 0)
- When low+critical is 0 but watch > 0: refuse `stockClear` / service-ready claims
- Name open Watch count tasks when present and surface them as priorities
- Thinking uses `ask.thinking.stock.watch` instead of a false clear
- True service-ready `stockClear` only when watch, low, and critical are all clear

### Sales POS connect/repair grounding
- Open `connect_pos` / `manage_pos_connection` / `repair_pos_connection` tasks block authoritative sales answers
- Name the POS follow-through and prefer those tasks as priorities
- Observed sales (when any) are labeled provisional; zero sales stays unavailable until connection work finishes
- Thinking uses `ask.thinking.sales.pos` instead of treating the sales pulse as healthy

## Paths
- `services/ai/askMise.ts`
- `i18n/catalog.ts`
- `tests/askMise.test.ts`
- `docs/automation-reports/2026-09-01-ask-stock-watch-sales-pos.md`

## Verification
- `npm run typecheck`
- focused `tests/askMise.test.ts`
- `npm test`

## Out of scope
- Does not duplicate Ask Mise stock count-trust (#316)
- Does not redo Ask Mise orders purchase-loop (#321), prep grounding (#319/#320), or stock trust recount flows
- Does not invent lead times, MOQ, or expiration fields
- No migration

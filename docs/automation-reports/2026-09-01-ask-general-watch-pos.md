# Ask Mise general Watch + POS fail-closed (2026-09-01)

## Summary

Ask Mise general intent no longer implies an all-clear when only Watch inventory remains, and it prefers POS connection tasks ahead of Watch count tasks while grounding sales thinking when POS work is still open.

## Behavior

### Watch-only stock on general
- When low+critical is 0 but `inventoryHealth.watch` > 0 and no open tasks/pending orders force another lead, refuse `ask.answer.fallback`
- Reuse stock Watch copy (`ask.answer.stock.watch.*`) plus `ask.answer.general.steer`
- Prefer open Watch count tasks in general priorities when watch-only stock applies

### POS sales on general
- Open `connect_pos` / `manage_pos_connection` / `repair_pos_connection` tasks are preferred ahead of Watch and other open work
- General thinking includes `ask.thinking.sales.pos` when those POS tasks are open (parity with sales/briefing)
- Healthy POS does not inject a trusted sales line into general answers

### Trusted clear retained
- General fallback remains only when there are no open tasks, no stock risk, no Watch inventory, and no pending recommendations

## Paths
- `services/ai/askMise.ts`
- `tests/askMise.test.ts`
- `docs/automation-reports/2026-09-01-ask-general-watch-pos.md`

## Verification
- `npm run typecheck`
- focused `tests/askMise.test.ts`
- `npm test`

## Out of scope
- Stacks on Ask Mise briefing Watch + POS fail-closed (#323)
- No new catalog keys (reuses stock/sales Watch+POS copy)
- No migration

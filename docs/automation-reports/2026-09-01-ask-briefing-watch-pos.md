# Ask Mise briefing Watch + POS fail-closed (2026-09-01)

## Summary

Ask Mise briefings no longer present a trusted board when only Watch inventory remains or when POS connect/repair tasks are still open. Stock and sales lines fail closed with explicit caveats, and follow-through tasks are preferred in the briefing focus list.

## Behavior

### Watch-only stock on briefing
- When low+critical is 0 but `inventoryHealth.watch` > 0, drop the trusted board that would report `0` stock risks
- Use `board.core` plus Watch-specific stock copy
- Prefer open Watch count tasks in briefing priorities/focus
- Thinking already uses `ask.thinking.stock.watch` for briefing

### POS sales on briefing
- Open `connect_pos` / `manage_pos_connection` / `repair_pos_connection` tasks block authoritative sales on the board
- Observed sales become provisional; zero sales stays unavailable
- Prefer those POS tasks ahead of other open work in briefing priorities
- Briefing thinking now uses `ask.thinking.sales.pos` (same as sales intent)

### Trusted board retained
- When stock is not watch-only and no POS sales tasks are open, keep the existing compact board sentence

## Paths
- `services/ai/askMise.ts`
- `i18n/catalog.ts`
- `tests/askMise.test.ts`
- `docs/automation-reports/2026-09-01-ask-briefing-watch-pos.md`

## Verification
- `npm run typecheck`
- focused `tests/askMise.test.ts`
- `npm test`

## Out of scope
- Stacks on Ask Mise stock Watch + POS sales grounding (#322)
- Does not invent lead times, MOQ, or expiration fields
- No migration

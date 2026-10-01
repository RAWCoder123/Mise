# Ask Mise priorities/general physical-count trust (2026-09-01)

Tip: `cursor/mise-ask-priorities-count-trust` (stacks on #325 Watch/POS priorities).

## Problem

After Watch/POS grounding (#325), Ask Mise priorities and general could still return
`ask.answer.fallback` (all-clear) when projected Low/Critical/Watch were empty but
physical counts were missing, stale, unverified, or contaminated. Managers could
treat the board as service-ready without a trustworthy count.

## Fix

- Port `inventoryCountTrust` domain + Today command-center wiring from #316.
- Stock, priorities, general, and briefing fail closed when trust is not authoritative.
- Thinking steps surface the blocking count-trust state.
- Fallback only when tasks, risk, Watch, pending orders, and count trust are all clear.

## Paths

- `services/domain/inventoryCountTrust.ts`
- `services/application/today.ts`
- `services/ai/askMise.ts`
- `i18n/catalog.ts`
- `tests/inventoryCountTrust.test.ts`
- `tests/askMise.test.ts`
- `docs/automation-reports/2026-09-01-ask-priorities-count-trust.md`

## Verification

- `npm run typecheck`
- focused askMise + inventoryCountTrust tests
- `npm test`

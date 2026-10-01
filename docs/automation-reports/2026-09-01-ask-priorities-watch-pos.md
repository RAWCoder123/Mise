# Ask Mise priorities Watch + POS fail-closed (2026-09-01)

Tip: `cursor/mise-ask-priorities-watch-pos` (stacks on #324 `cursor/mise-ask-general-watch-pos` @ `27b9f4c`).
Base: `origin/main` @ `20b28e5`.

## Problem

Ask Mise **priorities** intent still returned `ask.answer.fallback` ("nothing urgent") when:

- only Watch inventory remained and no open tasks were queued;
- pending supplier recommendations remained with no open tasks;
- open tasks existed but POS connection/repair work was not preferred ahead of Watch counts.

Briefing, general, stock, and sales already refused untrusted all-clear signals. Priorities was the residual parity gap.

## Fix

- Prefer POS then Watch when ordering priority chips (parity with briefing/general).
- When no open tasks remain, refuse fallback while stock risk, Watch counts, or pending orders remain; reuse grounded stock/Watch/orders copy plus the priorities insight tail.
- Extend priorities thinking with stock risk/Watch/clear, pending-order, and POS sales-trust steps when relevant.
- Keep fallback only when tasks, stock risk, Watch, and pending orders are all clear.

## Paths

- `services/ai/askMise.ts`
- `tests/askMise.test.ts`
- `docs/automation-reports/2026-09-01-ask-priorities-watch-pos.md`

## Verification

- `npm run typecheck`
- focused `tests/askMise.test.ts` — 17/17 pass
- no migration; no new catalog keys

## Classification impact

Controlled pilot code quality improvement for Ask Mise trust. Does not change App Store readiness blockers (founder legal URLs, EAS, live POS/Gmail, hosted security re-proof).

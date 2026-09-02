# 2026-09-02 — Manager waste ledger correction

## Completed

- Dedicated manager path to correct mistaken waste via append-only `correction`
  events that supersede a waste row once.
- Generic `requireInventoryOperation` still blocks `correction` / supersede links.
- Waste hub recent records: Correct → required note → confirm; EN/ES/zh-Hans.
- Hub fail-closed gates mutations on load readiness + manager role.
- Tests: `tests/wasteCorrection.test.ts` (validation, restore projection,
  analysis exclusion, second-correct conflict).

## Verification

- `npm run typecheck` pass
- `npm test` — 637 pass / 0 fail / 7 cancelled (pre-existing timeout cancellations)
- `npm run security:static` pass
- `npm run design:static` pass

## Not in this slice

- Staff waste role expansion (#214)
- Waste reason categories (#301)
- Consume substitutions / yields / modifiers in depletion (open stacks)
- Hosted Docker pgTAP / staging deploy of unrelated migrations

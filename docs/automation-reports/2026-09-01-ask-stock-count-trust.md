# Ask Mise stock count trust (2026-09-01)

## Problem
Ask Mise stock and briefing answers treated projected Low/Critical inventory as
authoritative even when physical counts were missing, stale, or contaminated.
That could invent an all-clear or overstate risk without recount guidance.

## Change
- Pure `summarizeInventoryCountTrust` collapses per-item prediction evidence into
  a fail-closed trust state.
- `fetchTodaySummary` attaches `inventoryCountTrust` from live outlook evidence.
- Ask Mise stock answers refuse all-clear / authoritative risk claims when trust
  is unavailable, empty, contaminated, unverified, or stale; stale/unverified
  risk is labeled provisional and points operators to recount.
- Briefing board uses an untrusted variant that omits stock-risk counts until
  counts are fresh and verified.
- EN / ES / zh-Hans catalog coverage for thinking and answer copy.

## Paths
- `services/domain/inventoryCountTrust.ts`
- `services/application/today.ts`
- `services/ai/askMise.ts`
- `i18n/catalog.ts`
- `tests/inventoryCountTrust.test.ts`
- `tests/askMise.test.ts`
- `docs/automation-reports/2026-09-01-ask-stock-count-trust.md`

## Verification
- `npm run typecheck`
- `node --test --import tsx tests/inventoryCountTrust.test.ts tests/askMise.test.ts`
- `npm test`

## Out of scope
- Does not duplicate inventory hub freshness UI (#313)
- Does not redo Ask Mise waste ledger grounding (#309) or readiness intents (#149)
- Does not change purchase authority or recommendation quantities

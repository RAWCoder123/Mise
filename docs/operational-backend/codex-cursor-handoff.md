# Codex ↔ Cursor handoff — daily-operating-plan-41

Updated: 2026-08-02

## Cursor slice (this pass)

Deterministic Daily Operating Plan projection for Today:

- Pure domain: `services/domain/operatingPlan.ts`
- Application facade: `services/application/operatingPlan.ts` → `fetchDailyOperatingPlan`
- Presentation: `presentOperatingPlanItem` / window labels in `operationsPresentation.ts`
- Today UI: `app/(tabs)/today.tsx` + `components/operations/OperatingPlanTimeline.tsx`
- Tests: `tests/operatingPlan.test.ts`
- i18n EN/ES/ZH plan keys in `i18n/catalog.ts`

Scope kept local: no migrations, no Edge, no fabricated staffing/weather/reservations/cutoff clocks. Section 11 phase briefs remain a later follow-on.

## Codex integration seam — completed

The handoff contract is now implemented:

1. Central task IDs route to `/tasks/[id]`; projected Today task IDs remain stable.
2. `services/application/operatingPlan.ts` loads tenant-scoped restaurant tasks and passes `centralTasks` into the pure builder.
3. The merge preserves:
   - service window / why / needed-by / effect
   - structured kind + related refs
   - dependency IDs only when evidenced
   - verification method
   - completion results only from real state/activity
   - deterministic overdue/delivery/risk/provider-failure reprioritization reasons
4. Today reads only `miseService.fetchDailyOperatingPlan`; it does not read repositories directly.
5. Personal device tasks remain an explicit separate scope; restaurant-wide is the default central scope.
6. Completion requires a real result, the full checklist, and verification evidence when configured; manager reopen is explicit.

## Do not touch (Cursor)

- `docs/launch/**`
- `supabase/migrations/**`, `supabase/functions/**`, `supabase/tests/**`
- `services/repositories/**`, `services/domain/restaurantTasks.ts`, `app/more/create-task.tsx`
- Shared-locked `contexts/**`, `constants/theme.ts`, `components/ui/**`

## Verification (Cursor)

- `npm run typecheck`
- `npm test` (411 passed, including central-task projection, replay, cancellation, and authorization coverage)
- `npm run supabase:test` (656 pgTAP assertions)
- In-app Browser and automated 390×844 interaction QA

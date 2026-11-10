# MISE-005ABL Operating Plan Timeline completionResult ASCII C (2026-11-10)

## Summary

Today's `OperatingPlanTimeline` always rendered raw `presentation.completionResult` into `today.plan.result` behind a raw-truthiness gate. Domain `completionResultForTask` Unicode-trims matched activity summary/title into the plan item, inventing a clean result body. Unicode-only-space results are truthy, so blank-looking `Result:  ` lines bypassed the intentional hide branch. Shared restaurant-task projection also feeds raw `task.completionResult` through the same chrome.

## Changes

- `services/domain/presentationOperatingPlanTimelineCompletionResultIdentity.ts` — ASCII C multiline free-text prep (NBSP fold; C end-trim; preserve LF/TAB/CR; soft-null em-space padding and disallowed controls)
- `components/operations/OperatingPlanTimeline.tsx` — soft-null before the `today.plan.result` interpolate / truthiness hide branch
- Focused inventing/bypass proofs in `tests/operatingPlanTimelineCompletionResultAsciiC.test.ts`
- No new catalog keys (soft-null restores the existing hide branch)

## Out of scope

- Restaurant-tasks durable complete/hydrate `completionResult` (#824 / MISE-005OP)
- Domain `completionResultForTask` / why assembly (#865)
- Task detail shared-task `completionResult` body (`app/tasks/[id].tsx`; left alone by #1025)
- Timeline display `presentation.title` (#1161 / MISE-005ZC)
- Timeline a11y title/detail (#1077 / #1078)
- Activity title/summary tips (#1148–#1151)

## Inventing proof

1. `"\u2003Counted 18 lb\u2003".trim() === "Counted 18 lb"` on domain activity summary/title → completionResult projection.
2. `Boolean("\u2003") === true` bypasses `isDone && presentation.completionResult ?` hide into blank-looking `Result:  `.
3. Shared-task path `completionResult: completed ? task.completionResult : null` always-passes raw free-text into the same chrome.

## Verification

- Focused tip tests: 5/5 (62 assertion call sites from source)
- `npm run typecheck`: passed
- `npm run security:static` + `design:static`: passed
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled (inherited withTimeout cancelledByParent; fixed in #1183, not landed)
- No migration
- Alone-OK beside #824 / #1161 / #1077 / #1078 (ordinary conflict only on `OperatingPlanTimeline.tsx`)

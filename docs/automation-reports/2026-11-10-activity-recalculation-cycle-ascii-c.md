# MISE-005ABW: pin Activity recalculation cycle under ASCII C

Date: 2026-11-10
Branch: `cursor/mise-activity-recalculation-cycle-ascii-c`
Baseline: `origin/main` @ `78da7376`

## Surface

Demo Activity emission in `fromRecalculationRunActivity` previously
always-passed raw `run.cycle` into operator-facing failure summary copy with
only underscore→space humanize:

```text
`Attempt ${run.attempt} of the ${run.cycle.replace(/_/g, " ")} recalculation did not complete. …`
```

Open #1232 / MISE-005ABV explicitly left this cycle humanize alone while
pinning `failureReason` in the same summary template.

## Change

- Added `services/domain/activityRecalculationCycleIdentity.ts`
- Wired `fromRecalculationRunActivity` failure summary through
  `normalizeActivityRecalculationCycle` with `"unknown"` soft-null fallthrough
- Underscore→space humanize remains a post-normalize step on the safe token
  only
- Soft-null Unicode-padded / control-bearing / empty tokens restore readable
  `"unknown"` cycle copy instead of blank-looking summary identity

## Left alone

- Activity recalculation failureReason (#1232 / MISE-005ABV)
- Recalculation-schedule failure-reason prep (#927 / MISE-005SO)
- Application `describeError` haystacks (#928 / MISE-005SP)
- Transport `p_failure_reason` pass-through
- Write-side cntrl sanitizer (#555 / MISE-005EQ)
- Activity title / summary i18n (#271)
- Raw `metadata.cycle`, `sequenceId`, and success-emission gate (`daily_open`)
- Restaurant Memory `convertMemoryToRule` title humanize (after #1230 lands)

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still rendered blank-looking cycle
  identity (`"Attempt N of the   recalculation…"`)
- `"\u2003daily_open\u2003".trim() === "daily_open"` inventing equality
- ASCII C soft-null restores the intentional `"unknown"` fallthrough

## Verification

- Focused `tests/activityRecalculationCycleAsciiC.test.ts` 5/5
  (66 assertion call sites counted from source)
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm test`
- No migration. Alone-OK beside #1232 (ordinary conflict only on
  `activityEvents.ts` + new identity module).

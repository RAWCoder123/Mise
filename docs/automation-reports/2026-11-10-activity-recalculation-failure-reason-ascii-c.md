# MISE-005ABV: pin Activity recalculation failureReason under ASCII C

Date: 2026-11-10
Branch: `cursor/mise-activity-recalculation-failure-reason-ascii-c`

## Surface

Demo Activity emission in `fromRecalculationRunActivity` previously
always-passed raw `run.failureReason` into operator-facing summary copy and
`errorMessage`, with only a nullish `?? "No failure reason was recorded."`
fallthrough. Open #927 / MISE-005SO explicitly left this Activity-event
pass-through alone.

## Change

- Added `services/domain/activityRecalculationFailureReasonIdentity.ts`
- Wired `fromRecalculationRunActivity` summary and `errorMessage` through
  `normalizeActivityRecalculationFailureReason`
- Soft-null Unicode-padded / control-bearing / empty tokens restore the
  intentional summary fallthrough and null `errorMessage`

## Left alone

- Cycle underscore-humanize in the same summary template
- Recalculation-schedule failure-reason prep (#927 / MISE-005SO)
- Application `describeError` haystacks (#928 / MISE-005SP)
- Transport `p_failure_reason` pass-through
- Write-side cntrl sanitizer (#555 / MISE-005EQ)
- Activity title / summary i18n (#271)
- Restaurant Memory convertMemoryToRule title humanize (after #1230 lands)

## Inventing / bypass proof

- `Boolean("\u2003") === true` bypassed `?? "No failure reason was recorded."`
- `"\u2003Timeout…\u2003".trim() === "Timeout…"` inventing equality
- ASCII C soft-null restores the intentional fallthrough

## Verification

- Focused `tests/activityRecalculationFailureReasonAsciiC.test.ts` 5/5
  (82 assertion call sites counted from source)
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm test` — 688 total / 681 pass / 0 fail / 7 cancelled (inherited
  withTimeout cancelledByParent; open #1183)
- No migration

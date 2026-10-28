# MISE-005SP recalculation describeError ASCII C

Date: 2026-10-28

## Summary

Pins application-layer `describeError` haystacks in
`services/application/recalculationCycles.ts` to ASCII C free-text prep so
Unicode `.trim()` cannot invent a clean durable `failureReason` /
`scheduleError` via NBSP or em-space padding before the run ledger write.

## Inventing proof

Prior path Unicode-trimmed `Error.message` / string errors before durable
projection:

```text
'\u2003Timeout while projecting inventory.\u2003'
  .trim()
  === 'Timeout while projecting inventory.'
```

That invented diagnostic became `failureReason` on the recalculation run
ledger and `scheduleError` on schedule-load failures.

## Change

- Add `services/application/recalculationDescribeErrorIdentity.ts`
- Route local `describeError` through `describeRecalculationError`
- Preserve never-null fallback `"Unknown recalculation failure"`
- Preserve 200-character bound after ASCII C prep
- Leave schedule failure-reason tip #927, schedule restaurant/timezone,
  transport restaurant, scheduled restaurant, #555 write-side cntrl
  sanitizer, activity-event `failureReason` pass-through, and transport
  `p_failure_reason` alone

## Verification

- Focused: `tests/recalculationDescribeErrorAsciiC.test.ts`
- `tests/recalculationCycles.test.ts`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`

## Merge note

Alone-OK with #927 / #733 / #788 / #734 / #735 / #555. Keep
`recalculationDescribeErrorIdentity.ts` separate from
`recalculationScheduleFailureReasonIdentity.ts`.

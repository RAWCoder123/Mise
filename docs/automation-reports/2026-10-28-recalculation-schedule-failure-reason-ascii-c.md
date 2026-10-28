# MISE-005SO: recalculation-schedule failure reasons ASCII C

## Inventing proof

Prior `normalizeFailureReason` Unicode-trimmed failed-run diagnostics before
storing them as operator-facing `lastFailureReason` and embedding them into
decision `reason` copy:

```text
'\u2003Timeout while projecting inventory.\u2003'.trim()
  === 'Timeout while projecting inventory.'
```

That invented equality with a clean diagnostic. Soft empty for Unicode-only
spaces still became `null` (preserved).

## Change

- Add `services/domain/recalculationScheduleFailureReasonIdentity.ts`
  (fold NBSP, C-locale end trim only, multiline control allowlist, soft null,
  max 200)
- Route `decideCycle` through `normalizeRecalculationScheduleFailureReason`
- Remove the local Unicode-trim `normalizeFailureReason` helper
- Leave schedule restaurant / timezone `.trim()`, application `describeError`
  haystacks, activity-event failureReason pass-through, transport
  `p_failure_reason`, and open #555 write-side cntrl sanitizer alone

## Alone-OK

Alone-OK with #733 / #788 / #734 / #735 / #555. Keep
`recalculationScheduleFailureReasonIdentity.ts` separate from those modules.

## Verification

- Focused: `tests/recalculationScheduleFailureReasonAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`

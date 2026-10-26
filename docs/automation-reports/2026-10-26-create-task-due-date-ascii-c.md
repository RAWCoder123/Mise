# MISE-005QU Create Task due-date ASCII C (2026-10-26)

Tip: `cursor/mise-create-task-due-date-ascii-c`

## Inventing proof

`app/more/create-task.tsx` `save()` Unicode-trimmed `dueDateText` before the
`YYYY-MM-DD` gate and the personal `createOperatorTask` `dueAt` payload
(`'\u20032026-08-01\u2003'.trim() === '2026-08-01'`,
`'\u00a02026-08-01\u00a0'.trim() === '2026-08-01'`). Soft empty / Unicode-only
space softs to `null` (omit dueAt). Em-space / NBSP-padded non-empty fails the
existing due-date error without inventing a clean ISO day. Ordinary ASCII space
padding still canonicalizes to a real `YYYY-MM-DD` UTC calendar day.

Open #880 owns Create Task title ASCII C only and intentionally left
`dueDateText.trim()` alone.
Open #870 owns Insights sales soft throughDate only.
Open #871 owns setup POS soft saleDate only.
Open #858 owns purchase-line throw-closed ISO dates.
None own this Create Task personal due-date identity path.

## Change

- `services/domain/createTaskDueDateIdentity.ts` — ASCII end trim +
  fail-closed canonicalize (real `YYYY-MM-DD` UTC day); soft normalize
- Wire Create Task `save()` through `normalizeCreateTaskDueDate`
- Leave title `.trim()` (#880), checklist line `.trim()`, body free-text,
  and `hasDueDate` emptiness-only Unicode trim alone

## Merge notes

Alone-OK with #880 / #870 / #871 / #858. Keep module separate from
`createTaskTitleIdentity.ts`, `insightsSalesThroughDateIdentity.ts`,
`setupPosSaleDateIdentity.ts`, and `purchaseLineIsoDateIdentity.ts`. When
landing with #880, drop #880's assertion that `dueDateText.trim()` still
Unicode-trims in `save()`, and drop this tip's assertion that `title.trim()`
still Unicode-trims once #880 owns that helper.

## Verification

- Focused `createTaskDueDateAsciiC`
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`
- Docker pgTAP unavailable in this environment

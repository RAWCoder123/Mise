# MISE-005RZ floor-notes dueAt ASCII C (2026-10-27)

Tip: `cursor/mise-floor-notes-due-at-ascii-c`

## Inventing proof

`services/application/floorNotes.ts` `normalizeDueAt` Unicode-trimmed `dueAt`
before the `YYYY-MM-DD` / ISO parse gate and durable AsyncStorage write
(`'\u20032026-08-05\u2003'.trim() === '2026-08-05'` →
`'2026-08-05T00:00:00.000Z'`, and
`'\u20032026-08-05T12:30:00.000Z\u2003'.trim() ===
'2026-08-05T12:30:00.000Z'`). Soft empty / Unicode-only space invented the
omit-dueAt branch via `'\u2003'.trim() === ''`.

Open #881 owns Create Task UI `dueDateText` only and does **not** own
application-layer floor-notes / operator-task `dueAt` canonicalize.
Open #838 owns floor-notes titles.
Open #839 owns floor-notes body.
Open #870 owns Insights sales soft throughDate.
Open #871 owns setup POS soft saleDate.
Open #858 owns purchase-line throw-closed ISO dates.
None own this floor-notes durable dueAt identity path.

## Change

- `services/domain/floorNotesDueAtIdentity.ts` — ASCII end trim + fail-closed
  canonicalize (date-only → start-of-day UTC ISO; full parseable ISO preserved);
  soft normalize
- Wire `normalizeDueAt` through `normalizeFloorNotesDueAt`
- Leave title `.trim()` (#838), body normalize (#839), restaurantId / taskId
  trim, and Create Task UI dueDateText (#881) alone

## Merge notes

Alone-OK with #881 / #838 / #839 / #870 / #871 / #858. Keep
`floorNotesDueAtIdentity.ts` separate from `createTaskDueDateIdentity.ts`.
Do **not** tip Create Task UI dueDateText through this module. When landing
with #881, keep both modules; Create Task UI still soft-fails padded drafts
before `createOperatorTask`, and this tip refuses inventing at the durable
normalize boundary (create + legacy migrate).

## Verification

- Focused `floorNotesDueAtAsciiC`
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`
- Docker pgTAP unavailable in this environment

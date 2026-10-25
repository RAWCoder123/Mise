# MISE-005PV restaurant-tasks evidence type ASCII C (2026-10-25)

## Inventing proof

`boundedEvidence` stored `record.type = record.type.trim()` for checklist and
completion evidence. NBSP/em-space padding invented a clean durable evidence-type
token before create/complete RPC arguments or hydrated task rows stored it:

- `'\u00a0count\u00a0'.trim() === 'count'`
- `'\u2003photo\u2003'.trim() === 'photo'`

## Change

- Add `services/domain/restaurantTasksEvidenceTypeIdentity.ts` (ASCII end trim;
  fail closed when Unicode trim would still strip end padding; full C0/DEL
  rejection; 80-character bound via `RESTAURANT_TASK_EVIDENCE_TYPE_MAX_CHARACTERS`)
- Route present evidence types in `boundedEvidence` through
  `requireCanonicalRestaurantTasksEvidenceType`
- Soft-empty type still falls back to label → `checklist_item`
- Label emptiness stays Unicode `.trim()` (emptiness-only; trimmed label is not
  stored)
- Leaves sibling `requiredText` / `optionalText` surfaces (title, detail,
  sourceReference, related ids, completionResult, …) on Unicode trim for their
  open tips

## Merge notes

Alone-OK. Keep helper module separate from finding-decision evidence type (#793)
and from restaurant-tasks sourceReference (#820) / free-text tips. When landing
with #820/#821/#822/#823/#824, drop mutual Unicode-trim cross-assertions on
sibling fields this tip leaves alone.

## Verification

Focused suite + `tests/restaurantTasks.test.ts`; `npm run typecheck`;
`npm run security:static` / `npm run security:backend`; `npm test`.

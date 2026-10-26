# MISE-005QY inventory count-sheet note ASCII C (2026-10-26)

Tip: `cursor/mise-inventory-count-sheet-note-ascii-c`

## Inventing proof

`app/inventory/count.tsx` `buildCountLinePayload()` Unicode-trimmed the
operator variance note before the over-long gate and the save/submit line
`note` payload
(`'\u2003Spill during prep\u2003'.trim() === 'Spill during prep'`,
`'\u00a0Spill during prep\u00a0'.trim() === 'Spill during prep'`), so NBSP /
em-space padding invented equality with a clean free-text variance note
before count-line save/submit stored it.

Soft empty / Unicode-only space softs to omit (prior `.trim()` emptiness →
omit optional note). Em-space padding is preserved as typed rather than
inventing equality with a clean note. NBSP folds to a plain space under the
ASCII C multiline free-text contract. Over-long stays a caller throw against
ASCII C prepared length (not a Unicode-trimmed inventing length).

Open #827 owns domain count-line note ASCII C (`mergeCountLineUpdates` /
`planCountSessionApprovals`) and intentionally left the count-sheet UI path
alone.
Open #846 owns miseValidation `requireInventoryCountLineNote` ASCII C and
intentionally left this UI path alone.
Open #845 owns count-session opening notes. Open #854 owns inventory-operation
notes (inventory detail only; Log Delivery still invents on main until after
#854 lands).

## Change

- `services/domain/inventoryCountSheetNoteIdentity.ts` — ASCII C multiline
  free-text prep + soft normalize for count-sheet variance notes
- Wire `app/inventory/count.tsx` `buildCountLinePayload()` through soft
  `normalizeInventoryCountSheetNote`
- Leave quantity draft `.trim()`, presentation show-note gates, domain #827,
  miseValidation #846, count-session opening note #845, and inventory-operation
  / Log Delivery notes alone

## Merge notes

Alone-OK with #827 / #846 / #845 / #854 / #883 / #884. Keep module separate.
When landing with #827, keep `inventoryCountSheetNoteIdentity.ts` separate
from `inventoryCountLineNoteIdentity.ts`; drop this tip's assertion that
domain merge/plan still Unicode-trims notes once #827 owns those helpers.
When landing with #846, drop this tip's assertion that
`requireInventoryCountLineNote` still Unicode-trims once #846 owns that
helper.

## Next tip preference

Prefer land/rebase of open stacks #348–#884 and #192 when merge capacity
exists. Next inventing candidates (verify live on main first): Log Delivery
`noteText.trim()` still invents on main while open #854 wired only
`app/inventory/[id].tsx` — tip log-delivery as a follow-up after #854 lands
(reuse `inventoryOperationNoteIdentity`; do not duplicate). Other remaining
Unicode-trim+use-result paths not tipped through #885 — prefer paths that
Unicode-trim **and use the trimmed result**. Do not retip #884/#883/#882/#881
/#880/#879/#878/#877/#876/#875/#874/#873/#872/#871/#870/#869/#868/#867/#866
or this count-sheet note tip. Do not retip domain #827 / validation #846 as
substitutes for this UI path.

## Verification

focused AsciiC 4/4; typecheck; security static/backend; npm test (see PR).
Docker pgTAP unavailable in this environment.

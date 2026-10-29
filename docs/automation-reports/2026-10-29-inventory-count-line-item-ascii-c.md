# MISE-005TT inventory count-line inventoryItemId ASCII C

Date: 2026-10-29  
Branch: `cursor/mise-inventory-count-line-item-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

miseValidation `requireInventoryCountLineUpdates` routed each line's
`inventoryItemId` / `inventory_item_id` through `String(...).trim()` before
duplicate detection and the returned save payload. Em-space / NBSP padding
invented a clean durable inventory-item identity
(`'\u2003tomatoes\u2003'.trim() === 'tomatoes'`).

Open #770 / MISE-005MN tips domain `mergeCountLineUpdates` inventoryItemId.
Open #860 / MISE-005PZ tips operator `requireInventoryOperation` scope IDs.
Open #767 / MISE-005MK tips application recipe-baseline inventoryItemId.
Open #846 / MISE-005PL tips count-line notes only. None owns this validation
boundary for count-line updates.

## Change

- Add `services/domain/inventoryCountLineItemIdentity.ts` with ASCII C
  single-line item identity prep (ASCII end trim only; fail closed when
  Unicode trim would still strip end padding; full C0/DEL control rejection;
  max 128).
- Route `requireInventoryCountLineUpdates` inventory item through fail-closed
  `requireCanonicalInventoryCountLineItemId` (empty / unsafe control /
  Unicode-padded / over-long / non-string keep
  `Count line ${n} is missing an inventory item.`).
- Leave count-line note prep on its existing contract (open #846).
- Focused inventing proofs in `tests/inventoryCountLineItemAsciiC.test.ts`.

## Verification

- Focused AsciiC: 3/3 pass
- `npm run typecheck` pass
- `npm run security:static` / `security:backend` pass
- `npm test`: 686 total / 679 pass / 0 fail / 7 cancelled (inherited
  recalculationCycles `withTimeout`); tip +3 vs main ~683
- Docker pgTAP unavailable in this environment

## Merge note

Alone-OK. Keep module separate from count-session inventoryItemId (#770 /
MISE-005MN), inventory-operation scope (#860 / MISE-005PZ), application
inventoryItemId (#767 / MISE-005MK), and count-line notes (#846 /
MISE-005PL). When landing with #846, drop any sibling assertion that
`inventoryItemId` still calls `String(...).trim()` if present.

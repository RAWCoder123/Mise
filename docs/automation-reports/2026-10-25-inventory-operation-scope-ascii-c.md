# MISE-005PZ inventory-operation restaurantId / inventoryItemId ASCII C

Date: 2026-10-25  
Branch: `cursor/mise-inventory-operation-scope-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

miseValidation `requireInventoryOperation` routed required `restaurantId` and
`inventoryItemId` through `requireBoundedText` Unicode `.trim()`. Em-space /
NBSP padding invented clean durable tenant / item identities before the
operator event was queued (`'\u00a0restaurant-a\u00a0'.trim() === 'restaurant-a'`
and `'\u2003chicken\u2003'.trim() === 'chicken'`).

Open #782 / #771 tip domain inventory-ledger accept paths; open #767 / #770 tip
application / count-session inventoryItemId helpers. None owns this operator
`requireInventoryOperation` boundary. Open #854 / #855 tip note and
reference/reason only.

## Change

- Add `INVENTORY_OPERATION_RESTAURANT_ID_MAX_CHARACTERS = 200` and
  `INVENTORY_OPERATION_INVENTORY_ITEM_ID_MAX_CHARACTERS = 200` to
  `services/domain/securityLimits.ts`.
- Add `services/domain/inventoryOperationScopeIdentity.ts` with ASCII C
  single-line scope identity prep (ASCII end trim only; fail closed when
  Unicode trim would still strip end padding; full C0/DEL control rejection;
  max 200).
- Route `requireInventoryOperation` restaurant / inventory item through
  fail-closed `requireCanonicalInventoryOperationRestaurantId` /
  `requireCanonicalInventoryOperationInventoryItemId` (empty / unsafe control /
  Unicode-padded / over-long / non-string keep
  `Enter a valid restaurant.` / `Enter a valid inventory item.`).
- Remove dead local `requireBoundedText` (both former callers now routed).
- Leave `sourceReference` / `reasonCode` / `note` on `optionalBoundedText`
  Unicode trim (open #855 / MISE-005PU owns reference/reason; open #854 /
  MISE-005PT owns note).
- Focused inventing proofs in
  `tests/inventoryOperationScopeAsciiC.test.ts`.

## Verification

- Focused AsciiC + inventoryOperationValidation: 8/8 pass
- `npm run typecheck` pass
- `npm run security:static` / `security:backend` pass
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (pre-existing)
- Docker pgTAP unavailable in this environment

## Merge note

Alone-OK. Keep module separate from inventory-operation note (#854 /
MISE-005PT), reference/reason (#855 / MISE-005PU), inventory ledger restaurant
(#782), ledger object (#771), application inventoryItemId (#767), and
count-session inventoryItemId (#770). When landing with #854 / #855, drop this
tip's assertions that `sourceReference` / `reasonCode` / `note` still call
`optionalBoundedText`, and drop their assertions that
`restaurantId` / `inventoryItemId` still call `requireBoundedText` if any
remain.

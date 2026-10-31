# MISE-005UX setup inventory unavailable-supplier error label ASCII C

Date: 2026-10-31  
Branch: `cursor/mise-setup-inventory-unavailable-supplier-label-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

Application `saveRestaurantSetup` Unicode-trimmed `draft.name` into `itemName` before embedding it in the unavailable-supplier Error (`${itemName} references an unavailable supplier.`). `'\u2003Roma Tomatoes\u2003'.trim()` invented `'Roma Tomatoes'`. Soft empty / Unicode-only space skipped the throw via `if (!itemName) continue`.

Open #977 / MISE-005UM owns the validateSetupInput `requires a configured supplier` path and left this save-path throw alone. Open #679 / MISE-005JJ owns durable `draft.name.trim()` / inventory-name keys and still leaves the error embedding inventing on main until this tip.

## Change

- Add `services/domain/presentationSetupInventoryUnavailableSupplierLabelIdentity.ts` with ASCII end trim; soft-null Unicode padding / controls / non-string.
- Route `services/application/setup.ts` unavailable-supplier error labels through `presentationSetupInventoryUnavailableSupplierLabel`; preserve `|| "Inventory item"` fallback.
- Leave durable `const itemName = draft.name.trim()` alone (open #679).
- Leave validateSetupInput supplier-required path alone (open #977).
- Focused inventing proofs in `tests/presentationSetupInventoryUnavailableSupplierLabelAsciiC.test.ts`.

## Ownership

Owns setup inventory unavailable-supplier error labels only. Does **not** own setup inventory supplier-required error labels (#977), setup-screen inventory validation labels (#974), durable setup inventory item names (#903), setup inventory-name keys (#679), quantity/par assertBounded labels (#979), recipe/ingredient validation labels (#975/#976), or setup supplier ChoiceChip labels (#973).

## Merge note

Alone-OK. Keep module separate from #977 supplier-required labels and #679 durable inventory-name keys. When landing with #679, keep `const itemName = …` durable assignment ownership with #679; this tip only owns the unavailable-supplier Error presentation.

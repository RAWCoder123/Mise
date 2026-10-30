# MISE-005UO: pin setup inventory quantity/par assertBounded error labels to ASCII C

Date: 2026-10-30  
Branch: `cursor/mise-setup-inventory-quantity-par-label-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

Application `validateSetupInput` embedded raw `item.name` into quantity / par
assertBounded Error labels (`${item.name || "Inventory item"} quantity`).

- Unicode-only space (`'\u2003'`) is truthy, so the intentional English
  `"Inventory item"` fallback was bypassed and padding was embedded into the
  thrown Error (`'\u2003 quantity'`).
- Em-space / NBSP-padded names invent a clean inventory identity under Unicode
  `.trim()` (`'\u2003Roma Tomatoes\u2003'.trim() === 'Roma Tomatoes'`), matching
  the sibling supplier-required inventing path already tipped as #977 /
  MISE-005UM. Soft-null refuse keeps those padded tokens from inventing a
  clean label or from embedding padding into assertBounded Errors.

## Change

- Add `services/domain/presentationSetupInventoryQuantityParLabelIdentity.ts`
  with ASCII end trim; soft-null Unicode padding / controls / non-string.
- Route `services/application/setup.ts` quantity / par assertBounded error
  labels through `presentationSetupInventoryQuantityParLabel`; preserve
  `|| "Inventory item"` fallback.
- Leave `hasDraftData` emptiness, supplier-required inventing (#977), durable
  `draft.name.trim()` save path (#679), recipe ingredient assertBounded
  labels, and quantity/par draft identity tips (#895 / #894) alone.
- Leave setup-screen inventory validation labels alone (open #974).

## Ownership

Owns application `validateSetupInput` inventory quantity / par assertBounded
Error label presentation only. Does **not** own supplier-required labels
(#977), setup-screen inventory validation labels (#974), durable inventory
item names (#903), inventory-name keys (#679), recipe/ingredient validation
labels (#975 / #976), or quantity/par draft identity (#895 / #894).

## Merge note

Alone-OK. Keep module separate from #977 supplier-required labels. When
landing with #977, drop #977's assertion that quantity/par labels still use
raw `item.name || "Inventory item"`.

## Verification

- Focused AsciiC tests
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`

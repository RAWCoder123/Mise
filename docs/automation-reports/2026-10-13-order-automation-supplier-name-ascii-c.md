# MISE-005OY orderAutomation supplierName ASCII C display prep (2026-10-13)

- Branch: `cursor/mise-order-automation-supplier-name-ascii-c`
- Base: `origin/main` @ `78da737`

## Inventing proof

Domain `assessOrderAutomation` Unicode-trimmed presentation `supplierName`. Em-space padding invented a clean supplier presentation name (`'\u2003Fresh Produce Co.\u2003'.trim() === 'Fresh Produce Co.'`).

ASCII C display prep (NBSP fold + C whitespace collapse + ASCII space trim) leaves em-space alone and does not invent equality with the unpadded name. NBSP padding folds intentionally (parity with MISE-005B / #410 / #691 / #692 / #821).

Soft empty / Unicode-only spaces → `""` (prior `.trim()` string contract). Normalize helper refuse control / over-long (>160) / non-string → `Order automation supplier name is invalid.`; assessment uses soft canonicalize only and does not newly throw on presentation text.

## Change

- `services/domain/orderAutomationSupplierNameIdentity.ts`
- Route `assessOrderAutomation` `supplierName` via `canonicalizeOrderAutomationSupplierName`
- Left `restaurantId.trim()` / `supplierId.trim()` alone (open tips #779 / #773)

## Verification

- focused AsciiC + existing orderAutomation tests
- typecheck / security static+backend
- npm test

## Merge

Alone-OK. Keep module separate from #773 / #779 order-automation identity tips and #821 relatedSupplierName. When landing with sibling tips, drop mutual Unicode-trim cross-assertions (open #773 asserts `supplierName.trim()`).

## Next siblings

- Prefer land/rebase open stacks #348–#832 and #192; close superseded stale PRs after land.
- Next prove-before-tip: `supplierReliability supplier_name` presentation (Unicode-trim **and use** the trimmed result).

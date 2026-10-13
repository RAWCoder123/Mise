# MISE-005PA supplierReliability delivery notes ASCII C free-text prep

Date: 2026-10-13  
Branch: `cursor/mise-supplier-reliability-delivery-notes-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

Domain `buildSupplierOrderDeliveryEvidence` Unicode-trimmed presentation
`delivery.notes` via `delivery.notes?.trim() || null`. Em-space padding invented
a clean delivery note (`'\u2003Late truck; crushed corner\u2003'.trim() ===
'Late truck; crushed corner'`).

ASCII C multiline free-text prep (NBSP fold + C-end trim only) leaves em-space
alone and does not invent equality with the unpadded note. Internal LF/TAB/CR
survive. Soft empty / Unicode-only spaces → `null` (prior `.trim() || null`
contract). Evidence build uses soft canonicalize only and does not newly throw
on presentation text. Normalize helper refuse control / over-long(>2000) /
non-string → distinct fail-closed messages.

## Change

- `services/domain/supplierReliabilityDeliveryNotesIdentity.ts`
- Route evidence `notes` via `canonicalizeSupplierReliabilityDeliveryNotes`
- Left `discrepancy_reason?.trim()` emptiness-only gates alone
- Left `order.supplier_name.trim()` / `supplier_id.trim()` / `restaurantId.trim()`
  alone (open #834 / #825 / #780)

## Verification

- focused AsciiC + supplierReliability: 13/13 pass
- `npm run typecheck` pass
- `npm run security:static` / `security:backend` pass
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled (inherited recalculationCycles timer flake)

## Merge

Alone-OK. Keep module separate from #834 supplierName, #825 supplier_id, and
#780 restaurant tips. Do not share helpers with inventory count-line notes
(#827) or mise-actions error/lesson (#828/#829).

# MISE-005OZ supplierReliability supplierName ASCII C display prep

Date: 2026-10-13  
Branch: `cursor/mise-supplier-reliability-supplier-name-ascii-c` @ `f189adc3`  
PR: #834  
Base: `origin/main` @ `78da737`

## Problem

Domain `buildSupplierReliabilitySummary` Unicode-trimmed presentation
`order.supplier_name` when seeding a reliability accumulator. Em-space
(`U+2003`) padding invented a clean supplier presentation name before the
entry returned it
(`'\u2003Pantry Co.\u2003'.trim() === 'Pantry Co.'`).

## Change

- Added `services/domain/supplierReliabilitySupplierNameIdentity.ts` with
  ASCII C display prep (NBSP fold + C whitespace collapse + ASCII space trim)
  and soft canonicalize / fail-closed normalize / require helpers.
- Routed reliability accumulator `supplierName` through
  `canonicalizeSupplierReliabilitySupplierName`. Soft empty → `""` matches the
  prior `.trim()` string contract; summary build does not newly throw on
  presentation text.
- Preserved require/normalize message
  `Supplier reliability supplier name is invalid.`
- Left `input.restaurantId.trim()` alone (open tip #780 / MISE-005MX).
- Left `order.supplier_id.trim()` Map-key grouping alone (open tip #825 /
  MISE-005OQ).
- Max length 160 to match hosted supplier display-name bound.

## Merge note

Alone-OK relative to open stacks through #833 and #192. Does not share identity
modules with supplier-reliability supplier_id (#825) or restaurant (#780).
When landing with open #825, drop that tip's assertion that domain
`supplierReliability` still Unicode-trims `order.supplier_name`. Keep modules
separate from #833 orderAutomation supplierName.

## Verification

- `tests/supplierReliabilitySupplierNameAsciiC.test.ts`: focused inventing proofs
- `tests/supplierReliability.test.ts`: existing reliability suite
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test` (expect pre-existing recalculationCycles cancelledByParent only)

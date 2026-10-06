# MISE-005JA — inventoryUnits client ASCII C parity

Date: 2026-10-06  
Branch: `cursor/mise-inventory-units-client-ascii-c`  
Base: `origin/main` @ `78da7376`

## Gap

`services/domain/inventoryUnits.ts` still folded unit tokens with Unicode-aware
`toLowerCase()` / `.trim()` / `\s` in `canonicalInventoryUnit`. MISE-005IV (#664)
and MISE-005IW (#665) pin SQL IMMUTABLE helpers
`private.canonical_unit_for_standard_unit` / `private.purchase_units_compatible`
to `lower(... collate "C")`. Client recipe/inventory unit identity used by setup,
POS mapping gates, and operational signals could disagree with the server after
dump/restore locale drift — including inventing a `kg` alias from Kelvin sign
`KG` via Unicode case fold.

## Change

- Fold only ASCII A-Z (same pattern as purchase-line / operationalMapping tips).
- Trim and collapse only ASCII whitespace after fold.
- Focused source + behavioral tests (3/3), including Kelvin-sign regression.

## Out of scope

- SQL conversion helpers (#664 / MISE-005IV)
- SQL `purchase_units_compatible` (#665 / MISE-005IW)
- Purchase-line client unit helpers (#668 / MISE-005IZ)
- `operationalMapping.normalizeUnit` client pin (owned by #664)

## Classification

Controlled pilot-ready codebase tip. Not App Store submission-ready.

# MISE-005IT: purchase_recommendations.reason cntrl locale pin

Date: 2026-10-06

## Change

CHECK-only locale pin for durable `purchase_recommendations.reason` prose:

- Reattach `purchase_recommendations_operational_values_check` preserving exact length and quantity bounds.
- Preserve MISE-005FX (#588) `item_name collate "C" !~ '[[:cntrl:]]'`.
- Preserve MISE-005FY (#589) `supplier_name collate "C" !~ '[[:cntrl:]]'`.
- Preserve MISE-005FZ (#590) `unit collate "C" !~ '[[:cntrl:]]'`.
- Add multiline-aware `reason collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'` (allows LF/TAB/CR; rejects other C0 controls and DEL), matching `unsafeSupplierSendMultilineControlPattern` / MISE-005EM operator_note.
- Classified as free-form purchase-recommendation prose (not a single-line label).
- Does not rewrite recommendation writers or tip sibling inventory/POS item-name fields.

## Dependencies

- Land after #590 (`purchase_recommendations.unit`) so the shared CHECK reattach preserves item_name + supplier_name + unit pins.
- Alone-OK relative to inventory_items cntrl stack (#585–#587) and #661 discrepancy_reason. Timestamp ordered after #590 / #661 for migration sequencing.

## Verification

- `npm run typecheck`
- focused `purchaseRecommendationsReasonCntrlLocalePin`
- `npm test` when available
- pgTAP plan derived from assertion call sites in source

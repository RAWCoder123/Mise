# Reject out-of-window purchase line dates (2026-09-25)

## Gap
MISE-004C `purchase_lines` accepted any parseable ISO `transaction_date` /
`received_date`. Managers could append absurd future or ancient invoice dates
and scramble `list_purchase_line_net_by_item` first/last windows.

## Change
- Domain: `assertPurchaseLineCalendarDateInWindow` + `normalizePurchaseLineInput`
  reject dates more than 1 day ahead of UTC today or more than 90 days behind.
- Constants: `PURCHASE_LINE_DATE_MAX_LOOKBACK_DAYS` / `PURCHASE_LINE_DATE_FUTURE_SKEW_DAYS`
  in `securityLimits.ts`, re-exported from `purchaseLines.ts`.
- DB: additive BEFORE INSERT trigger
  `private.reject_out_of_window_purchase_line_dates` — does **not** redeclare
  `ingest_purchase_lines` / `append_purchase_line` (composes with open MISE-006).

## Verification
- Domain + migration pin tests
- pgTAP `purchase_line_date_bounds.test.sql` (8 assertions; plan counted from source)
- typecheck / security gates / focused npm tests

## Not in scope
Inventory event date stacks (#367/#373), MISE-006 schema (#397), UI/i18n.

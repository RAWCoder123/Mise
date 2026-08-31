# Draft order expected delivery date edit (2026-08-31)

## Completed
- Managers can set, revise, or clear `delivery_date` on draft supplier orders from order detail.
- `requireSupplierDeliveryDate` validates YYYY-MM-DD calendar days (or null) before `updateSupplierOrder`.
- Dirty delivery date participates in send-preview refresh; demo/hosted content revision already bumps on delivery-date change.
- EN / ES / zh-Hans copy for the editor and save notices.

## Verification
- `npm run typecheck`
- `npm test` (632 passed, 7 cancelled)
- `npm run security:static`

## Remaining
- Receive-line `unit_price` / invoice total capture (contested receive stack).
- Inventory purchase-unit correction (Codex `safe_patch`).
- `ingredient_substitutions` manager CRUD (Codex write RPC).
- Land/rebase open stacks #187–#293.

## Classification
Controlled pilot-ready code path; not App Store submission-ready.

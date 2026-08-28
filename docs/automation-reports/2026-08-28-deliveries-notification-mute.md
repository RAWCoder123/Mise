# Deliveries / overdue mute category (2026-08-28)

## Stack

- Base: `#207` operator notification preferences
- Merged: `#204` sent→receive Today tasks, `#205` overdue delivery Home outlook
- Branch: `cursor/mise-deliveries-notification-mute`

## Closed

- New muteable category `deliveries` split from purchasing `orders`
- Receive Today codes (`today.order.receive` / `.received`) and `receive_supplier_order` intent map to `deliveries`
- Operating-plan `delivery_overdue` reprioritization maps to `deliveries`
- Muting deliveries clears Home overdue delivery attention via `filterOperatingBriefByNotificationPreferences` while keeping draft purchase watches and inventory/approval risks
- Today operating plan already filtered through existing preference pipeline
- Additive migration `20260828123000_operator_notification_deliveries_category.sql` allowlists `deliveries` and fills missing keys as enabled
- Settings UI + EN/ES/zh-Hans copy; orders copy no longer claims deliveries
- Unit + security pins; pgTAP payloads updated

## Not done

- Push/email delivery of muted categories
- Composing purchase-pattern multipliers (#200–#202)
- Landing/rebasing the open stack onto `main`

## Verification

- `npm run typecheck`
- `npm test` (notification preference suites + full suite)
- `npm run security:static` / `npm run security:backend` when available

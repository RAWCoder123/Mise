# Operator Today alert preferences (2026-08-27)

Branch: `cursor/mise-operator-notification-preferences`
Base: `origin/main` @ `20b28e5`

## Closed

Operators can mute Today attention categories without changing restaurant data
or teammate views.

- Allowlisted categories: `inventory`, `orders`, `waste`, `recipes_pos`,
  `insights`, `setup`
- Identity-free `get_my_notification_preferences` /
  `update_my_notification_preferences` RPCs (locale-preference pattern)
- Direct `users.notification_preferences` UPDATE revoked from authenticated
- Demo AsyncStorage + hosted Supabase adapters
- Settings `/settings/notifications` + Preferences hub row
- Today operating plan filtered by muted categories; human/floor tasks stay visible
- EN / ES / zh-Hans copy
- Unit, security-static, and pgTAP contracts

## Intentionally deferred

- Overdue-delivery mute category until #204 / #205 land
- Push / email delivery (in-app Today attention only)
- Storage-location transfer vertical slice (inventory PR stack collision)

## Verification

- `npm run typecheck` — passed
- `npm test` — 641 pass / 0 fail / 7 withTimeout cancellations
- `npm run security:static` — passed
- `npm run security:backend` — passed
- Hosted/Docker `supabase:test` still environment-dependent

## Classification impact

Does not change controlled-pilot readiness by itself. Improves operator
usability as Home/Today alert volume grows (#205 overdue, #206 POS fail).

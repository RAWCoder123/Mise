# Operator Today alert preferences (2026-08-02)

## Gap
Operators had no way to mute Today attention categories. Notification preference UX was completely absent (no schema, Edge path, or Settings screen), so busy managers could not quiet lower-priority task families without losing the rest of the command center.

## Change
- Domain: allowlisted categories (`inventory`, `orders`, `waste`, `recipes_pos`, `insights`, `setup`) with normalize/toggle helpers and Today-task filtering by presentation family.
- Migration `20260802170000_operator_notification_preferences.sql`:
  - `users.notification_preferences` jsonb (defaults all-on)
  - identity-free `get_my_notification_preferences()`
  - Edge-owned `service_update_my_notification_preferences(actor, preferences)`
  - legacy mutator revoked from authenticated; direct column UPDATE revoked
- Demo AsyncStorage adapter + hosted repository/Edge wiring through `operational-workflows`.
- Settings → Today alerts screen with on/off category rows; Preferences hub row; Today filters muted categories.
- i18n EN/ES/zh-Hans + `common.off`.
- Unit, security contract, and pgTAP coverage authored.

## Behavior
1. Preferences are personal operator profile metadata, never authorization inputs.
2. Hosted reads use auth.uid(); writes reserve Edge with session restaurant scope and always mutate the authenticated actor.
3. Muting a category hides matching Today tasks for that operator only.
4. No push/APNs/FCM provider is introduced.

## Verification
- `npm run typecheck`
- `npm test` (381)
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes` (includes `/settings/notifications`)
- Docker `supabase:test` still pending in this environment

## Classification
Still **controlled pilot-ready** pending Docker/hosted re-proof and founder App Store/credentials steps.

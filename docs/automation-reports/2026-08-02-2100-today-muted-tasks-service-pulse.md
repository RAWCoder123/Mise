# Today muted-tasks + service pulse (2026-08-02)

## Gap
Today treated muted notification categories as an operational all-clear:
- Task section showed “No operational work is waiting” when every open task was hidden by alert preferences.
- Service pulse could claim “Service is on track” while setup, POS, recipe, or other open tasks remained.

## Change
- Domain: `countHiddenOperationalTodayTasksByNotificationPreferences`, `areOperationalTodayTasksHiddenByNotificationPreferences`.
- Domain: `classifyTodayServicePulse` prioritizes stock risk → order review → open tasks → ready.
- Today UI: muted empty row with CTA to `/settings/notifications`; pulse uses open-task count.
- i18n: EN / ES / zh-Hans keys for muted tasks and open-task pulse copy.

## Verification
- `npm run typecheck`
- `npm test` — 395 passed
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`
- Docker `supabase:test` unavailable in this environment

## Branch
`cursor/mise-product-inspection-1abd` (FF from `8e39` tip + this work)

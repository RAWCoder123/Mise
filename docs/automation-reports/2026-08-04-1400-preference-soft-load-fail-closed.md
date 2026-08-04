# Automation report — Preference soft-load fail-closed

Date: 2026-08-04 ~14:00 UTC  
Branch: `cursor/mise-product-inspection-7e3e`

## Gap

Locale and notification preference contexts cleared `loadError` at the start of every soft-refresh, so settings could become interactive again while a denied/stale hosted scope was still reloading. Soft-refresh also kept last-known mute preferences in context state that Today and Settings continued to apply for operational filtering and muted-count copy—even after a load denial—until membership revalidation cleared the workspace.

Tenant-authorization save failures restored prior values but left `loadError` false, so preference controls stayed interactive after a denied write.

## Fix

1. `resolveEffectiveNotificationPreferences` — operational muting fails closed to all-enabled defaults whenever prefs are not ready or `loadError` is true.
2. `LocaleContext` / `NotificationPreferencesContext` — soft-refresh keeps `loadError` sticky until a successful load; hard reload still clears; tenant-authorization save failures set `loadError`.
3. Today filters/hidden-task counts use effective prefs only.
4. Settings hub notification subtitle uses preference load-state summary (loading / unavailable / muted / all on) instead of stale mute counts during denial.
5. Tests + App Store checklist tenant-isolation note updated.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`

Docker `supabase:test` and hosted staging re-proof remain environment-blocked in this run.

## Classification

Still controlled pilot-ready pending Docker/hosted gates; not App Store submission-ready.

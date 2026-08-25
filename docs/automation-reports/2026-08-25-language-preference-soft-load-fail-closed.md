# Language preference soft-load fail-closed (2026-08-25)

## Gap
`/settings/language` treated preference load failures as ready (device/default selection),
wiped prior values on every scope reload, and had no RetryNotice for denied hosted loads.

## Fix
- `LocaleContext`: `loadError`, `reload(showLoading?)`, soft-refresh via `loadedScopeRef`,
  sticky `loadError` during soft reload, tenant-auth save denials set `loadError`.
- `preferenceSettingsPresentation.ts`: load-state / selection / note / notice helpers.
- Language screen: Screen loading until ready, non-interactive selection on error,
  RetryNotice hard reload, StatusNotice for save outcomes, EN/ES/zh-Hans copy.

## Paths
- `contexts/LocaleContext.tsx`
- `app/settings/language.tsx`
- `services/presentation/preferenceSettingsPresentation.ts`
- `i18n/catalog.ts`
- `tests/preferenceSettingsPresentation.test.ts`
- `tests/clientTenantSafety.test.ts`
- `docs/automation-reports/2026-08-25-language-preference-soft-load-fail-closed.md`

## Do not redo
- Reintroducing NotificationPreferencesContext (not on main).
- Changing identity-free hosted locale RPC adapter wiring in `_layout.tsx`.

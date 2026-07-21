# Localization foundation

Mise supports `en`, `es`, and `zh-Hans` through the typed flat catalog in
`i18n/catalog.ts`. `LocaleProvider` supplies translation and locale-aware date,
number, currency, relative-time, and operational due-time helpers. Local demo
preferences are persisted with AsyncStorage; authenticated preferences are
stored as bounded profile metadata through current-user Supabase RPCs.

## Hosted preference repository hook

Hosted persistence is deliberately injected through
`HostedLocalePreferenceAdapter`; it does not use direct table access from a
screen. The repository integration follows these boundaries:

1. `public.users.preferred_locale` is nullable (unset means use the supported
   device locale) and constrained to `en`, `es`, or `zh-Hans`.
2. `get_my_preferred_locale()` and `update_my_preferred_locale(text)` derive the
   target exclusively from `auth.uid()` and accept no user or restaurant ID.
3. Both functions pin an empty `search_path`; default/public/anonymous execution
   is revoked and only `authenticated` receives the narrow execute grant.
4. Direct profile UPDATE authority remains revoked. Locale is display metadata
   and is never consulted for restaurant membership or role authorization.
5. `hostedLocalePreferenceAdapter` calls the two identity-free RPCs through the
   configured public Supabase client and is injected once in `app/_layout.tsx`.

When Supabase is not configured, the hosted adapter is `null`; demo mode retains
AsyncStorage persistence and unauthenticated sessions use the supported device
locale.

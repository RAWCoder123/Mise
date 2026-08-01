# Localization foundation

Mise supports `en`, `es`, and `zh-Hans` through the typed flat catalog in
`i18n/catalog.ts`. `LocaleProvider` supplies translation and locale-aware date,
number, currency, relative-time, and operational due-time helpers. Local demo
preferences are persisted with AsyncStorage; authenticated preferences are
stored as bounded profile metadata through Edge-owned service RPCs.

## Hosted preference repository hook

Hosted persistence is deliberately injected through
`HostedLocalePreferenceAdapter`; it does not use direct table access from a
screen. The repository integration follows these boundaries:

1. `public.users.preferred_locale` is nullable (unset means use the supported
   device locale) and constrained to `en`, `es`, or `zh-Hans`.
2. Locale reads remain identity-free through `get_my_preferred_locale()`.
   Locale writes route through Edge `operational-workflows` →
   `service_update_my_preferred_locale(actor, locale)`. The legacy authenticated
   `update_my_preferred_locale(text)` execute grant is revoked.
3. Service RPCs pin an empty `search_path` and re-check the actor before commit.
4. Direct profile UPDATE authority remains revoked. Locale is display metadata
   and is never consulted for restaurant membership or role authorization.
5. `hostedLocalePreferenceAdapter` reads through the identity-free RPC and writes
   through the Edge workflow path; it is injected once in `app/_layout.tsx`.

When Supabase is not configured, the hosted adapter is `null`; demo mode retains
AsyncStorage persistence and unauthenticated sessions use the supported device
locale.

## Today command center

The Today tab builds operator-facing copy through `buildTodayCopy(t)` from
`i18n/catalog.ts` (`today.*` keys, plus shared `inventory.health.*` and
`common.viewAll` / `common.showLess`). Locale parity is enforced by the typed
catalog and `tests/localization.test.ts`; do not reintroduce a screen-local
`todayCopy` map.

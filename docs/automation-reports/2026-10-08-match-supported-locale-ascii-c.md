# MISE-005KR: pin matchSupportedLocale identity to ASCII C

## Summary

`matchSupportedLocale` in `i18n/catalog.ts` used Unicode-aware `trim()` and
`toLowerCase()` when resolving device and preference language tags to the
supported App Locale set. Unicode `trim()` strips NBSP / em-space / other
Unicode spaces around an otherwise-valid tag, inventing a normalized locale
identity from padded evidence and authorizing the unpadded supported locale.

This tip pins locale-tag identity to ASCII-only end trim and ASCII C case fold
(A–Z only), then continues the existing BCP 47 underscore→hyphen and prefix
matching for `en` / `es` / Simplified Chinese. Ordinary ASCII whitespace still
trims; Unicode padding fail-closes to no match (and `resolveSupportedLocale`
falls back to English).

## Scope

- Client i18n `i18n/catalog.ts` (`matchSupportedLocale`)
- Focused static + behavioral tests
- Does **not** re-tip preferred_locale SQL CHECK/writer (#488),
  InventoryHealth display labels, error-message haystacks
  (`inventoryEventTransport` / `recalculationPorts`), operationalSignals
  cosmetic copy, or tipped fields through #720 / #719 / #718
- Does **not** change catalog message strings or add new locales

## Verification

- `npm run typecheck`
- focused `tests/matchSupportedLocaleAsciiC.test.ts` + `tests/localization.test.ts`
- `npm test`
- `npm run security:static` / `npm run security:backend` when available

## Product note

Controlled pilot-ready codebase. This hardens language-tag identity before
locale selection; it does not unblock Apple signing, live POS credentials, or
App Store submission.

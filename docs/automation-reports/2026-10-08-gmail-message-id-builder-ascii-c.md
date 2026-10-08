# MISE-005KJ: gmailMessageId builder ASCII C

Date: 2026-10-08

## Change

Pin `gmailMessageId` order-id / domain fold and shape checks to ASCII C:

- Add `asciiCLowerGmailMessageIdToken` (ASCII A-Z only).
- Replace Unicode `/iu` UUID and domain gates plus `toLowerCase()` with
  ASCII-C fold then lowercase-only shape regexes.
- Kelvin-sign domains such as `mail.mise.apK` no longer invent
  `@mail.mise.apk` Message-IDs.

## Why

Unicode `RegExp` `/iu` treats Kelvin as matching `k`, and `String#toLowerCase`
then invents the ASCII domain. Supplier-send Message-IDs are durable delivery
identity; inventing a different domain breaks claim/complete continuity versus
hosted COLLATE `"C"` email tips.

## Scope boundaries

- Does **not** retarget `sanitizeHeader` / `sanitizeGmailHeader` (#693).
- Does **not** retarget `isAsciiCGmailRfcMessageIdShape` / `requireMessageId` (#694).
- Does **not** retarget `normalizeEmail` (#423).
- Alone-OK beside #693/#694 (same `gmail.ts`, disjoint helpers).

## Verification

- `npm run typecheck`
- focused `tests/gmailMessageIdBuilderAsciiC.test.ts`
- `npm test` when available
- `npm run security:static` / `npm run security:backend`

# MISE-005PS restaurant logo URL ASCII C (2026-10-14)

## Summary

Stop Unicode `.trim()` on restaurant profile `logo_url` from inventing a clean
durable HTTPS logo URL via em-space / NBSP padding
(`'\u2003https://cdn.example.com/logo.png\u2003'.trim() ===
'https://cdn.example.com/logo.png'`).

- Add `services/domain/restaurantLogoUrlIdentity.ts` (ASCII end trim only;
  fail closed when Unicode trim would still strip end padding; preserve HTTPS
  validation)
- Route profile patches through exported `requireHttpsLogoUrl` →
  `normalizeCanonicalRestaurantLogoUrl`
- Leave restaurant address / operational profile notes via
  `requireNullableBoundedText`, name (#844), cuisine (#842), and hydrate
  `asNullableString(logo_url)` alone

## Inventing proof

`requireHttpsLogoUrl` previously routed `logo_url` through
`requireNullableBoundedText`, which Unicode-trimmed and stored the result after
HTTPS validation. Em-space / NBSP padding invented a clean HTTPS logo URL before
the hosted `update_restaurant_profile` RPC saw it. Hosted `btrim` leaves those
pads alone; client inventing creates a durable identity the SQL path would not
have produced from the same padded input.

ASCII C single-line logo URL prep (ASCII end trim only; fail closed when
Unicode trim would still strip end padding) leaves em-space alone and does not
invent equality with the unpadded HTTPS URL. Soft empty / Unicode-only spaces
stay soft-null as before.

## Alone-OK merge notes

Alone-OK with open address tip #850 / MISE-005PP and notes tip #851 /
MISE-005PQ. When landing together, drop mutual Unicode-trim cross-assertions
that assume address / notes still call `requireNullableBoundedText`; keep
`restaurantLogoUrlIdentity.ts` separate from `restaurantAddressIdentity.ts` /
`operationalProfileNotesIdentity.ts`. Preserve prior HTTPS / length error
wording.

## Verification

- focused `tests/restaurantLogoUrlAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`

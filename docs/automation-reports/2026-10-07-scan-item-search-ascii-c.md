# MISE-005KB: pin Scan Item text-search identity to ASCII C

## Summary

`app/more/scan-item.tsx` still normalized typed inventory search with
Unicode-aware `trim` / `toLowerCase`. Sibling tip #687 already pins barcode /
inventory match tokens on the same screen to ASCII C, and hosted helpers fold
under SQL `lower(... collate "C")`. Under Unicode case folding, a Kelvin sign
(`K`) becomes `k`, which can invent a typed-search hit the ASCII C path would
refuse.

This tip moves Scan Item typed-search matching into
`services/domain/scanItemSearchIdentity.ts` with ASCII C case fold and
ASCII-only end trim, so Kelvin lookalikes and non-C whitespace cannot invent
substring identity while browsing or filtering inventory on Scan Item.

## Scope

- Client domain helper `scanItemSearchIdentity.ts`
  (`normalizeScanItemSearchToken`, `scanItemMatchesQuery`)
- Wire `app/more/scan-item.tsx` through those helpers
- Focused static + behavioral tests
- Does **not** re-tip inventory barcode match (#687), inventory tab search,
  Log Delivery search, recipes-settings (#689), or setup-screen supplier
  identity (#696)
- Does **not** rewrite SQL uniqueness / CHECK migrations
- Does **not** expand Scan Item SKU capture (owned by open #218)

## Verification

- `npm run typecheck`
- focused `tests/scanItemSearchIdentityAsciiC.test.ts`
- `npm test`
- `npm run security:static` / `npm run security:backend` when available

## Product note

Controlled pilot-ready codebase. This closes a Scan Item typed-search
identity parity gap beside the barcode-match tip; it does not unblock live
POS credentials or App Store submission.

# MISE-005QL setup POS itemName/category ASCII C (2026-10-26)

## Summary

Pin guided POS CSV `itemName` / `category` identity to ASCII C end trim so
Unicode cell trim and label trim cannot invent clean durable POS item or
category labels before accepted import rows and fingerprints store them.

## Inventing proof

On `origin/main`, `parseSetupPosSalesCsv` Unicode-trimmed every CSV cell and
then Unicode-trimmed `itemName` / `category` again:

- `'\u2003Chicken Bowl\u2003'.trim() === 'Chicken Bowl'`
- `'\u00a0Mains\u00a0'.trim() === 'Mains'`

Soft empty Unicode-only padding previously collapsed through `.trim()` into
the intentional item_name review path or category `"Sales"` fallthrough.

## Ownership

- Open #676 / MISE-005JG owns header alias + fingerprint ASCII case fold only.
- Open #871 / MISE-005QK owns setup POS `saleDate` calendar identity only.
- Open #869 / MISE-005QI owns Insights sales aggregation labels only.
- Open #862 / MISE-005QB owns setup recipe `dishName` only.
- Open #863 / MISE-005QC owns inventory recipe `menuItemName` only.

None own this setup POS CSV soft itemName / category identity path.

## Change

- `services/domain/setupPosItemLabelIdentity.ts` — ASCII end trim +
  fail-closed canonicalize; soft normalize
- Wired `parseSetupPosSalesCsv` itemName / category via
  `normalizeSetupPosItemLabel`
- CSV `itemName` / `category` cells keep raw value before ASCII C prep
- Left saleDate / quantity / grossSales / header normalize alone

## Merge notes

Alone-OK with #676 / #871 / #869 / #862 / #863. Keep module separate.

When landing with #871:

- Drop #871 assertions that `(record.itemName ?? "").trim()` /
  `(record.category ?? "").trim()` still exist.
- Extend #871's saleDate keep-raw cell rule so `itemName` / `category` also
  stay raw (or keep this tip's `itemName || category ? raw : raw.trim()` and
  fold saleDate into the keep-raw set).

When landing with #676:

- Keep durable itemName / category prep on `normalizeSetupPosItemLabel`.
- Keep itemName / category cells raw before that prep.
- Keep #676 `asciiCNormalizeToken` fingerprint fold on the already-canonical
  stored labels.

## Verification

- Focused `setupPosItemLabelAsciiC` tests
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test` (note inherited recalculationCycles timer flake on this runner)

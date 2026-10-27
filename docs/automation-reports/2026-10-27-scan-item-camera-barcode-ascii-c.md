# MISE-005RY Scan Item camera barcode ASCII C

Date: 2026-10-27

## Inventing proof

`app/more/scan-item.tsx` `handleBarcode` Unicode-trimmed `result.data` before
`matchInventoryBarcode`, `lastScannedCode`, and `setQuery`:

```text
'\u2003012345678905\u2003'.trim() === '012345678905'
```

NBSP / em-space padding therefore invented a clean scanned code used for
navigation, multi-match lists, and typed-search seeding. Unicode-only space
invented the empty / ignore-scan branch via `'\u2003'.trim() === ''`.

Open #687 owns barcode match token normalize (Kelvin / ASCII C fold). Open
#697 owns typed Scan Item text-search. Neither owns camera payload end-trim.

## Change

- New `services/domain/scanItemCameraBarcodeIdentity.ts` (MISE-005RY)
- Soft empty / Unicode-only space → `empty` (ignore scan)
- ASCII whitespace still trims clean before match / display / query seed
- Unicode-padded / control-bearing → `invalid` (ignore scan; no invent)
- Wire `handleBarcode` through `prepareScanItemCameraBarcodeText(result.data)`
- Left `matchesQuery` (#697) and `normalizeInventoryBarcodeToken` (#687) alone

## Landing notes

Alone-OK with #687 / #697 / #698. Keep `scanItemCameraBarcodeIdentity.ts`
separate. Do not tip typed search or barcode match tokens through this module.

## Verification

- focused AsciiC 4/4
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test` 687 total / 687 pass / 0 fail / 0 cancelled (tip +4 vs main ~683)
- Docker pgTAP unavailable in this environment

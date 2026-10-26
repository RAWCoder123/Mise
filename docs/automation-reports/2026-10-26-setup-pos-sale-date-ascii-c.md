# MISE-005QK setup POS saleDate ASCII C (2026-10-26)

Tip: `cursor/mise-setup-pos-sale-date-ascii-c`

## Inventing proof

Guided POS CSV import Unicode-trimmed `saleDate` cells and
`normalizeSaleDate` before accepting ISO / slash calendar tokens as the
durable imported sale date and fingerprint component
(`'\u20032026-08-01\u2003'.trim() === '2026-08-01'`,
`'\u00a06/30/2026\u00a0'.trim() === '6/30/2026'`). Soft empty / unsafe /
Unicode-padded / non-calendar → `""` so row validation keeps
`Use YYYY-MM-DD for the sale date.`

Open #676 owns setupDrafts header/fingerprint normalize only.
Open #862 owns setup recipe dish names only.
Open #861 owns setup inventory units only.
Open #870 owns Insights sales soft throughDate only.
Open #858 owns purchase-line throw-closed ISO dates.
None own this setup POS CSV soft saleDate identity path.

## Change

- `services/domain/setupPosSaleDateIdentity.ts` — ASCII end trim +
  fail-closed canonicalize (real `YYYY-MM-DD` / `M/D/YYYY` UTC day); soft
  normalize
- Wired `parseSetupPosSalesCsv` saleDate via `normalizeSetupPosSaleDate`
- CSV `saleDate` cells keep raw value (no Unicode cell trim) before ASCII C
  canonicalize; leave itemName / category / quantity trim alone

## Merge notes

Alone-OK with #676 / #862 / #861 / #870 / #858. Keep module separate. Leave
itemName / category Unicode trim alone. When landing with #676, drop any
#676 assertion that saleDate cells still Unicode-trim before
`normalizeSaleDate`, and keep `setupPosSaleDateIdentity.ts` separate from
header/fingerprint helpers.

## Verification

- Focused `setupPosSaleDateAsciiC`: 4/4
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled
  (pre-existing `recalculationCycles` `withTimeout` hung-promise
  `cancelledByParent` on this runner; not introduced by this tip)
- Docker pgTAP unavailable in this environment

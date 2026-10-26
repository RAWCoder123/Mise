# MISE-005RB autonomy spend-limit ASCII C (2026-10-26)

Tip: `cursor/mise-autonomy-spend-limit-ascii-c`.

## Inventing proof

`app/settings/autonomy.tsx` `persist()` Unicode-trimmed `draft.spendLimitText`
for emptiness and parsed with ECMAScript `Number` (Unicode TrimString):

- `Number('\u200325.50\u2003') === 25.5` → `2550` cents
- `'\u2003'.trim() === ''` invented the empty / no-limit branch

## Change

- New `services/domain/autonomySpendLimitIdentity.ts` (MISE-005RB)
- Soft empty / Unicode-only space → `empty` (`null` cents)
- ASCII whitespace still trims clean before `Number`
- Unicode-padded / control / non-finite / negative → `invalid` (spendInvalid)
- Leave #877 communicationType and #878 allowed-window times alone

## Verification

- focused `tests/autonomySpendLimitAsciiC.test.ts` 4/4 pass
- `npm run typecheck` pass
- `npm run security:static` / `security:backend` pass
- `npm test` 687 total / 687 pass / 0 fail / 0 cancelled (tip +4 vs main baseline ~683)
- Docker pgTAP unavailable in this environment

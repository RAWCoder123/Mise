# Home confidence rationale + watching coverage i18n (2026-08-27)

## Completed
- Structured `confidenceReasons` on recommendation approval cards
- Localized confidence fragments for EN/ES/zh-Hans via presentation
- Surfaced confidence line on Home approval cards
- Attached `inventoryCoverage` evidence on watching inventory rows
- Wired watching detail through `localizeInventoryCoverage`

## Stacks on
- #210 Home operating-brief domain i18n (`d7ea5d1`)

## Verification
- `npm run typecheck`
- focused presentation + operatingBrief tests
- `npm test`

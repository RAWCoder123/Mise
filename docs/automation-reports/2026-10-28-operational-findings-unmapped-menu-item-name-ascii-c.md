# MISE-005SL: pin operational-findings unmapped menu-item names to ASCII C

Date: 2026-10-28

## Inventing proof

`buildDailyOperationalBrief` Unicode-trimmed and collapsed unmapped-sale
menu-item names through shared `boundedText`
(`.trim().replace(/\s+/g, " ")`) before storing durable finding freshness
`missingData` tokens as `menu_mapping:${name}`.

```text
'\u2003Salmon Bowl\u2003'
  .trim().replace(/\s+/g, " ")
  === 'Salmon Bowl'
```

Mid-string em-spaces likewise invented an ASCII-collapsed key
(`'Salmon\u2003Bowl'` → `'Salmon Bowl'`). Soft empty / Unicode-only spaces
previously fell back to `"menu item"` (max 80) and remain on that contract.

## Change

- Add `services/domain/operationalFindingsUnmappedMenuItemNameIdentity.ts`
  (NBSP fold + C-locale whitespace collapse + ASCII space trim; soft empty
  fallback; max 80).
- Route the unmapped-sale `missingNames` path in
  `services/domain/operationalFindings.ts` through
  `boundedCanonicalOperationalFindingsUnmappedMenuItemName`.
- Leave sibling `boundedText` surfaces (`title`, `explanation`,
  `recommendedAction`, evidence `summary`, confidence `rationale`) on
  Unicode trim.
- Do not share helpers with #920 title, #921 explanation, #922
  recommendedAction, #923 evidence summary, #755 restaurant workspace,
  #831 finding-decision evidence summary, #832 finding-decision
  recommended-action, or #875 pilot readiness sale item names.

## Verification

- Focused: `tests/operationalFindingsUnmappedMenuItemNameAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`

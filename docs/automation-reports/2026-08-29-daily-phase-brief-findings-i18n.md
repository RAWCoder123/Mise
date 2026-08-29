# Daily phase brief findings i18n (2026-08-29)

## Summary
Localize Daily Brief prioritized findings and unavailable-signal boundary copy for EN/ES/zh-Hans without inventing operational facts.

## Changes
- Domain findings carry structured `presentation` descriptors alongside English fallback title/interpretation.
- Presentation helpers localize templates and known unavailable signals; unknown signals and null presentation pass through.
- Daily Brief UI renders presented titles/bodies and localized signal lists.
- Catalog templates added for finding kinds, verification labels, and unavailable signals.

## Verification
- `npm run typecheck`
- `node --test tests/dailyPhaseBrief.test.ts tests/dailyPhaseBriefPresentation.test.ts`
- `npm test`
- `npm run design:static` / `npm run security:static` as available

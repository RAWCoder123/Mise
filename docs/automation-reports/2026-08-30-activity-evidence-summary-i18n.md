# Activity evidence summary i18n (2026-08-30)

## Scope

Localize Activity hub **expanded evidence-line summaries** from parent
`activityType` + structured metadata without rewriting durable English audit
rows. Complements #239 (evidence type / enum labels) and #271 (event
title/summary copy).

## Changes

- `services/presentation/activityEvidenceCopy.ts` — `presentActivityEvidenceSummary`
- `i18n/catalog.ts` — EN / ES / zh-Hans evidence templates
- `app/more/activity.tsx` — expanded evidence lines use presentation helper
- `tests/activityEvidenceCopy.test.ts`

## Localized structured patterns

| Parent activity | Evidence summary template |
| --- | --- |
| `inventory_count_recorded` | Current quantity {quantity} {unit} |
| `waste_analysis_completed` | {quantity} {unit} recorded as waste |
| `inventory_risk_detected` | {itemName} projected at {quantity} {unit} |

## Non-goals

- Category / status / trigger / evidence-type enum labels (#239)
- Event title / summary presentation (#271)
- Rewriting stored English evidence summary columns
- Translating free-form recommendation reasons or finding evidence
- Translating item / supplier business names
- Activity window sentence

## Verification

- `npm run typecheck`
- `npm test` (activityEvidenceCopy + suite)
- `npm run security:static`

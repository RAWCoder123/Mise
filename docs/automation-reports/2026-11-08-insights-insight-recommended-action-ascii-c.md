# MISE-005AAA Insights InsightListRow recommendedAction ASCII C

Date: 2026-11-08

## Surface

Insights manager-brief `InsightListRow` always passed raw
`presentation.recommendedAction` into `styles.actionText`.

## Inventing proof

1. Structured `insight.rule.*` recommended actions embed free-form item /
   supplier names (`salesAction`, `inventoryAction`, `prepAction`,
   `wasteAction`).
2. Opaque `insight.evidence.opaque` composes
   `` `${sourceRecommendationLabel}: ${rawRecommendedAction}` `` from free-form
   `insight.recommended_action`.
3. Unicode-padded / Unicode-only-space free-text still yields truthy
   blank-looking or trim-invented action copy on the always-pass actionText
   Text.

## Fix

- Soft-null through ASCII C prep in
  `services/domain/presentationInsightsInsightRecommendedActionIdentity.ts`.
- Live fallback `insights.insight.recommendedAction.none` (EN / ES / zh-Hans).
- Leave `presentation.title`, `presentation.description`, and
  `presentation.whyItMatters` raw on this tip.

## Alone-OK

Beside open #1185 / #1184 / #1143 / #1134 (no shared identity modules; ordinary
conflict only on `app/(tabs)/insights.tsx` / `i18n/catalog.ts`; no migration).

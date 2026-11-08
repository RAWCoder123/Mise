# MISE-005AAB Insights InsightListRow whyItMatters ASCII C

Date: 2026-11-08

## Surface

Insights manager-brief `InsightListRow` truthy-gated raw
`presentation.whyItMatters` into `styles.insightEvidence`.

## Inventing proof

1. Opaque `insight.evidence.opaque` composes
   `` `${evidenceLabel}: ${rawWhyItMatters}` `` from free-form
   `insight.why_it_matters` whenever that raw field is truthy.
2. Unicode-padded / Unicode-only-space free-text still yields truthy
   blank-looking or trim-invented why copy that opens the InsightListRow
   evidence gate.
3. Structured `insight.rule.*` why copy is controlled but shares the same
   InsightListRow display path, so the same soft-null gate applies.

## Fix

- Soft-null through ASCII C prep in
  `services/domain/presentationInsightsInsightWhyItMattersIdentity.ts`.
- Live `whyItMatters ? (...) : null` hide when soft-null (no localized none
  invent for an optional evidence row).
- Leave `presentation.title`, `presentation.description`, and
  `presentation.recommendedAction` raw on this tip.

## Alone-OK

Beside open #1186 / #1185 / #1184 / #1136 / #1135 / #1038 (no shared identity
modules; ordinary conflict only on `app/(tabs)/insights.tsx`; no migration;
no catalog change).

## Verification

- `npm run typecheck`: passed
- focused `insightsInsightWhyItMattersAsciiC` tests: 6/6 (90 assertion call
  sites from source)
- `npm test`: 689 total / 682 pass / 0 fail / 7 cancelled (inherited
  withTimeout cancelledByParent; fixed in #1183, not landed)

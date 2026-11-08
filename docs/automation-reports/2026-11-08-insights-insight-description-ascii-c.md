# MISE-005ZY: pin Insights InsightListRow presentation.description to ASCII C

Date: 2026-11-08  
Branch: `cursor/mise-insights-insight-description-ascii-c`  
Baseline: `origin/main` @ `78da7376` (MISE-005A)

## Inventing proof

Insights manager-brief `InsightListRow` always passed raw `presentation.description` into the insightDescription Text:

```tsx
<Text style={styles.insightDescription}>{presentation.description}</Text>
```

When an insight has no presentation descriptor, `presentInsight` falls through to `insight.evidence.opaque` and composes:

```ts
description: `${evidenceLabel}: ${rawTitle}. ${rawDescription}`
```

from free-form `insight.title` / `insight.description`. Proven:

- `"\u2003Roma Tomatoes low\u2003".trim() === "Roma Tomatoes low"` invents a clean title identity before composition.
- Opaque padded composition remains truthy (`"Evidence: \u2003Roma…. \u2003Check…"`) and previously rendered blank-looking or Unicode-padded InsightListRow copy with no localized none marker.
- Unicode-only-space title+description still yields `"Evidence: \u2003. \u2003"` — non-nullish blank-looking description bypass.

Structured `insight.rule.*` descriptions that embed free-form item / menu / supplier names share the same InsightListRow display path.

## Change

- Add `services/domain/presentationInsightsInsightDescriptionIdentity.ts` (single-line ASCII C end trim; soft-null Unicode padding / controls; preserve NBSP; no LF/TAB/CR allowlist).
- Route InsightListRow `presentation.description` through `normalizeInsightsInsightDescription` → `insights.insight.description.none` (EN Description / ES Descripción / zh-Hans 说明).
- Leave InsightListRow `presentation.title`, `presentation.whyItMatters`, and `presentation.recommendedAction` raw on this tip.
- Leave Insights signal presentation.detail / label / value (#1166–#1168), How-Mise-knows memory copy (#1169–#1171), and Daily Brief finding.explanation (#1142) alone.

## Verification

- Focused `insightsInsightDescriptionAsciiC` 6/6 (79 assertion call sites counted from source).
- `npm run typecheck`
- `npm run security:static` / `security:backend` / `design:static`
- `npm test` (report final totals in PR)

No migration.

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.

# MISE-005ZZ Insights InsightListRow presentation.title ASCII C

Date: 2026-11-08

## Surface

`app/(tabs)/insights.tsx` InsightListRow always passed raw
`presentation.title` into `styles.insightTitle`.

## Inventing proof

Structured `insight.rule.inventory.stock_risk` (and sibling rule titles)
embed free-form inventory / menu item names into localized templates such as
`${itemName} may run out today`. Unicode-padded or Unicode-only-space item
names invent blank-looking or Unicode-trimmed InsightListRow titles via the
truthy always-pass title Text and `.trim()`. Opaque insight-type titles share
the same InsightListRow display path.

## Fix

- Soft-normalize through `normalizeInsightsInsightTitle` (ASCII end trim;
  preserve NBSP; full C0/DEL rejection; soft-null when Unicode trim would
  still strip end padding).
- Fall through to localized `insights.insight.title.none`
  (EN Title / ES Título / zh-Hans 标题).
- Leave `presentation.description`, `whyItMatters`, and `recommendedAction`
  raw on this tip.

## Alone-OK

Beside #1184 / #1166–#1171 / #1145 (no shared identity modules; ordinary
conflict only on `app/(tabs)/insights.tsx` / `i18n/catalog.ts`; no migration).

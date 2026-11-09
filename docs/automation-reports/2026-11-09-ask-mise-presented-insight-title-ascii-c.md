# MISE-005ABB Ask Mise presentedInsight.title ASCII C

Date: 2026-11-09

## Summary

Pins Ask Mise sales / priorities / briefing answer-text `presentInsight(...).title`
interpolations (`presentedInsight.title`) to ASCII C so Unicode-padded /
Unicode-only-space / control-bearing structured insight titles (free-form menu
or inventory names embedded in templates like `${itemName} demand is rising`)
cannot invent blank-looking or Unicode-trimmed `{insight}` copy.

Soft-nulls through `normalizeAskMisePresentedInsightTitle` and falls through to
localized `ask.answer.presentedInsightTitle.none` (EN Insight / ES Señal /
zh-Hans 信号). Leaves Insights InsightListRow title (#1185) and Ask Mise prep /
waste insight-title joins (#1212) raw on this tip.

## Files

- `services/domain/presentationAskMisePresentedInsightTitleIdentity.ts`
- `services/ai/askMise.ts`
- `i18n/catalog.ts`
- `tests/askMisePresentedInsightTitleAsciiC.test.ts`
- `docs/automation-reports/2026-11-09-ask-mise-presented-insight-title-ascii-c.md`

## Inventing proof

- Free-form item name Unicode trim invents clean identity:
  `"\u2003Chicken Bowl\u2003".trim() === "Chicken Bowl"`.
- Composed title Unicode end padding invents equality with the clean title:
  `"\u2003Chicken Bowl demand is rising\u2003".trim() === "Chicken Bowl demand is rising"`.
- Padded free-form item name still composes a truthy Unicode-padded title that
  previously interpolated into sales / priorities / briefing `{insight}`.
- Unicode-only-space item name composes a blank-looking truthy title that
  previously interpolated without an intentional localized none marker.

Distinct from Insights InsightListRow presentation.title (#1185) and from Ask
Mise prep / waste `presentInsight(...).title` joins (#1212 / MISE-005ABA).

## Verification

- `npm run typecheck`
- focused `askMisePresentedInsightTitleAsciiC` 1/1 (93 assertion call sites from source)
- `npm test`
- No migration

## Alone-OK

Beside #1185 / #1212 / #1209 / #1164 / #1045 / #961 / #1145 (no shared identity
modules; ordinary conflict only on `services/ai/askMise.ts` / `i18n/catalog.ts`).

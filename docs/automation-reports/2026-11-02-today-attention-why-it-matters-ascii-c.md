# TodaySummary sales-spike attention why_it_matters ASCII-C tip (2026-11-02)

## Milestone

MISE-005WB

## Defect

`buildTodaySummary` selected sales-spike attention-card context with:

```ts
context: spikeInsight.why_it_matters ?? "Mise is learning this pattern."
```

Unicode-only-space `why_it_matters` values are non-nullish under `??`, so the
attention card bypassed the intentional hard-coded
`"Mise is learning this pattern."` empty state. Empty string has the same
bypass. Unicode `.trim()` on padded why prose would invent a clean attention
context before TodaySummary projects that card.

## Fix

- Add `services/domain/presentationTodayAttentionWhyItMattersIdentity.ts`
- Soft-null via `normalizeTodayAttentionWhyItMatters` before the
  `"Mise is learning this pattern."` row in `buildTodaySummary`
- ASCII end trim only; preserve NBSP; full C0/DEL reject

## Alone-OK

Does **not** own Daily Ops `pickSignalLine` why_it_matters (#867),
operational-findings explanations (#921), Home ApprovalsSection
`whyItMatters`, Home StatusNotice approval titles (#1011), or the sibling
importantInsight attention path that uses `why_it_matters ?? undefined`.

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.

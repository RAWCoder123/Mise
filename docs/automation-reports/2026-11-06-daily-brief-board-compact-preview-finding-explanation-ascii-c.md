# MISE-005YO: pin Daily Brief Board compact-preview firstFinding.explanation to ASCII C

Date: 2026-11-06  
Branch: `cursor/mise-daily-brief-board-compact-preview-finding-explanation-ascii-c`  
Base: `origin/main` @ `78da7376`

## Closed

Daily Brief Board compact-preview `firstFinding.explanation` inventing / blank-body bypass via prior always-pass:

```tsx
<Text numberOfLines={1} style={styles.previewBody}>
  {firstFinding.explanation}
</Text>
```

Soft-null empty / Unicode-padded / unsafe finding explanations → localized
`dailyBrief.compactPreview.findingExplanation.none` (EN / ES / zh-Hans). Alone-OK
beside #1146 / #1145 / #1142 / #1075 / #1074 / #1076 / #920 / #1143 / #1144
(no migration). Distinct from Board explanation tip (#1142 / MISE-005YJ) and
compact-preview title tip (#1146 / MISE-005YN).

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still rendered as the previewBody Text with no localized none fallback
- `"\u2003Chicken Breast has less than one service day of projected coverage.\u2003".trim() === "Chicken Breast has less than one service day of projected coverage."` inventing equality
- ASCII C soft-null restores `dailyBrief.compactPreview.findingExplanation.none`

## Leave alone

- Compact preview `firstFinding.title` (#1146 / MISE-005YN)
- Board finding-card title display (#1145 / MISE-005YM)
- Board explanation display (#1142 / MISE-005YJ)
- Card header a11y finding.title (#1075 / MISE-005XO)
- Action a11y finding.title (#1074 / MISE-005XN)
- Daily Phase Brief finding-row a11y finding.title (#1076 / MISE-005XP)
- Domain finding title (#920 / MISE-005SH)
- Board recommendedAction display (#1143 / MISE-005YK)
- Board effectiveRecommendedAction annotation (#1144 / MISE-005YL)
- `app/more/daily-brief.tsx` finding chrome

## Alone-OK

No migration. Beside #1146 / #1145 / #1142 / #1075 / #1074 / #1076 / #920 /
#1143 / #1144. Ordinary UI conflicts possible with Daily Brief inventing stacks.

## Verification

- Focused `dailyBriefBoardCompactPreviewFindingExplanationAsciiC` 5/5 (plan derived from 66 assertion call sites)
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm run design:static`
- `npm test` 688 total / 681 pass / 0 fail / 7 cancelled (pre-existing `recalculationCycles` hung-timeout cancellations; unrelated to this tip)

No migration. Docker pgTAP not run in this environment.

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.

# MISE-005YN: pin Daily Brief Board compact-preview firstFinding.title to ASCII C

Date: 2026-11-06  
Branch: `cursor/mise-daily-brief-board-compact-preview-finding-title-ascii-c`  
Base: `origin/main` @ `78da7376`

## Closed

Daily Brief Board compact-preview `firstFinding.title` inventing / blank-body bypass via prior always-pass:

```tsx
<Text numberOfLines={1} style={styles.previewFinding}>
  {firstFinding.title}
</Text>
```

Soft-null empty / Unicode-padded / unsafe finding titles → localized
`dailyBrief.compactPreview.findingTitle.none` (EN / ES / zh-Hans). Alone-OK
beside #1145 / #1075 / #1074 / #1076 / #920 / #1142 / #1143 / #1144 (no
migration). Distinct from Board finding-card title tip (#1145 / MISE-005YM),
card header a11y title tip (#1075 / MISE-005XO), action a11y title tip
(#1074 / MISE-005XN), Phase Brief row a11y title tip (#1076 / MISE-005XP), and
domain title tip (#920 / MISE-005SH).

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still rendered as the previewFinding Text with no localized none fallback
- `"\u2003Low stock risk\u2003".trim() === "Low stock risk"` inventing equality
- ASCII C soft-null restores `dailyBrief.compactPreview.findingTitle.none`

## Leave alone

- Board finding-card title display (#1145 / MISE-005YM)
- Card header a11y finding.title (#1075 / MISE-005XO)
- Action a11y finding.title (#1074 / MISE-005XN)
- Daily Phase Brief finding-row a11y finding.title (#1076 / MISE-005XP)
- Domain finding title (#920 / MISE-005SH)
- Compact preview `firstFinding.explanation`
- Board explanation display (#1142 / MISE-005YJ)
- Board recommendedAction display (#1143 / MISE-005YK)
- Board effectiveRecommendedAction annotation (#1144 / MISE-005YL)
- `app/more/daily-brief.tsx` finding title chrome

## Alone-OK

No migration. Beside #1145 / #1075 / #1074 / #1076 / #920 / #1142 / #1143 /
#1144. Ordinary UI conflicts possible with Daily Brief inventing stacks.

## Verification

- Focused `dailyBriefBoardCompactPreviewFindingTitleAsciiC` 5/5 (plan derived from assertion call sites)
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm run design:static`
- `npm test` 688 total / 681 pass / 0 fail / 7 cancelled (pre-existing `recalculationCycles` hung-timeout cancellations; unrelated to this tip)

No migration. Docker pgTAP not run in this environment.

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.

# MISE-005YJ: pin Daily Brief Board finding.explanation to ASCII C

Date: 2026-11-06  
Branch: `cursor/mise-daily-brief-board-explanation-ascii-c`  
Base: `origin/main` @ `78da7376`

## Closed

Daily Brief Board finding-card `finding.explanation` inventing / blank-body bypass via prior always-pass:

```tsx
<Text style={styles.cardBody}>{finding.explanation}</Text>
```

Soft-null empty / Unicode-padded / unsafe explanations → localized `dailyBrief.explanation.none` (EN / ES / zh-Hans). Alone-OK beside #1141 / #1140 / #1139 / #1134 / #921 / #922 / #920 / #884 / #1085 (no migration). Distinct from operational-findings domain explanation tip (#921 / MISE-005SI).

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still rendered as the cardBody Text with no localized none fallback
- `"\u2003Chicken Breast has less than one service day of projected coverage.\u2003".trim() === "Chicken Breast has less than one service day of projected coverage."` inventing equality
- ASCII C soft-null restores `dailyBrief.explanation.none`

## Leave alone

- Domain explanation boundedText (#921 / MISE-005SI)
- Finding title (#920), recommendedAction domain (#922), Daily Brief edit (#884)
- Board `finding.title` / `recommendedAction` / `effectiveRecommendedAction` display
- Daily Phase Brief finding.interpretation a11y (#1085)
- Export UI `noticeForExportError` classification (no free-text inventing; Edge payload tipped #933)
- Inventory count / detail / Log Delivery Error.message tips (#1141 / #1139 / #1140)

## Alone-OK

No migration. Beside #1141 / #1134 / #921 / #922 / #920 / #884 / #1085. Ordinary UI conflicts possible with Daily Brief inventing stacks.

## Verification

- Focused `dailyBriefBoardExplanationAsciiC` 5/5
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm run design:static`
- `npm test` 688 total / 688 pass / 0 fail / 0 cancelled

No migration. Docker pgTAP not run in this environment.

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.

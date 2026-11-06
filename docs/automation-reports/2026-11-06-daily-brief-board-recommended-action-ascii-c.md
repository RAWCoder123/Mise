# MISE-005YK: pin Daily Brief Board finding.recommendedAction to ASCII C

Date: 2026-11-06  
Branch: `cursor/mise-daily-brief-board-recommended-action-ascii-c`  
Base: `origin/main` @ `78da7376`

## Closed

Daily Brief Board finding-card `finding.recommendedAction` inventing / blank-body bypass via prior always-pass:

```tsx
<Text style={styles.recommended}>{finding.recommendedAction}</Text>
```

Soft-null empty / Unicode-padded / unsafe recommended actions → localized `dailyBrief.recommendedAction.none` (EN / ES / zh-Hans). Alone-OK beside #1142 / #1134 / #922 / #884 / #920 / #921 / #1085 (no migration). Distinct from operational-findings domain recommendedAction tip (#922 / MISE-005SJ) and Daily Brief edit tip (#884 / MISE-005QX).

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still rendered as the recommended Text with no localized none fallback
- `"\u2003Order 12 lb from Fresh Produce Co.\u2003".trim() === "Order 12 lb from Fresh Produce Co."` inventing equality
- ASCII C soft-null restores `dailyBrief.recommendedAction.none`

## Leave alone

- Domain recommendedAction boundedText (#922 / MISE-005SJ)
- Daily Brief recommended-action edit normalize (#884 / MISE-005QX)
- Finding title (#920), Board explanation display (#1142 / MISE-005YJ), domain explanation (#921)
- Board `finding.title` / `finding.explanation` / `effectiveRecommendedAction` annotation display
- Daily Phase Brief finding.interpretation a11y (#1085)
- Home Approvals recommendedAction (#1134 / MISE-005YB)
- Export UI `noticeForExportError` classification (no free-text inventing; Edge payload tipped #933)

## Alone-OK

No migration. Beside #1142 / #1134 / #922 / #884 / #920 / #921 / #1085. Ordinary UI conflicts possible with Daily Brief inventing stacks.

## Verification

- Focused `dailyBriefBoardRecommendedActionAsciiC` 5/5
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm run design:static`
- `npm test` 688 total / 681 pass / 0 fail / 7 cancelled (pre-existing `recalculationCycles` hung-timeout cancellations; unrelated to this tip)

No migration. Docker pgTAP not run in this environment.

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.

# MISE-005YR: pin Activity row event.summary to ASCII C

Date: 2026-11-07  
Branch: `cursor/mise-activity-row-summary-ascii-c`  
Base: `origin/main` @ `78da7376`

## Closed

Activity hub row `event.summary` inventing / blank-body bypass via prior always-pass:

```tsx
<Text style={styles.summary} numberOfLines={expanded ? undefined : 3}>
  {event.summary}
</Text>
```

Soft-null empty / Unicode-padded / unsafe summaries → localized `activity.row.summary.none` (EN / ES / zh-Hans). Alone-OK beside #1148 / #1149 / #1071 / #1049 / #1072 / #1142 (no migration). Distinct from Home ActivityRow `event.summary` (next inventing candidate) and Activity hub row title tip (#1148 / MISE-005YP).

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still rendered as the summary Text with no localized none fallback
- `"\u2003Chicken Breast counted at 18 lb.\u2003".trim() === "Chicken Breast counted at 18 lb."` inventing equality
- ASCII C soft-null restores `activity.row.summary.none`

## Leave alone

- Activity hub row event.title (#1148 / MISE-005YP)
- Home ActivityRow event.title (#1149 / MISE-005YQ)
- Activity expand a11y event.title (#1071 / MISE-005XK)
- Home ActivityRow `event.summary` display (next inventing candidate)
- Create Task list-row a11y (#1072)
- Home ApprovalsSection card.title (#1049)
- Daily Brief Board finding.explanation (#1142)

## Alone-OK

No migration. Beside #1148 / #1149 / #1071 / #1049 / #1072 / #1142. Ordinary UI conflicts possible with Activity inventing stacks.

## Verification

- Focused `activityRowSummaryAsciiC` 5/5 (56 assertion call sites; plan from source)
- `npm run typecheck` passed
- `npm run security:static` / `security:backend` passed
- `npm run design:static` passed
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled (inherited recalculationCycles)

No migration. Docker pgTAP not run in this environment.

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.

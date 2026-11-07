# MISE-005YW: pin Activity expanded evidence.summary to ASCII C

Date: 2026-11-07  
Branch: `cursor/mise-activity-evidence-summary-ascii-c`  
Base: `origin/main` @ `78da7376`

## Closed

Activity expanded evidence-line `evidence.summary` inventing / blank-body bypass via prior always-pass:

```tsx
<Text key={`${evidence.type}:${evidence.id}`} style={styles.evidenceLine}>
  {evidence.type.replace(/_/g, " ")} — {evidence.summary}
</Text>
```

Soft-null empty / Unicode-padded / unsafe summaries → localized `activity.evidence.summary.none` (EN / ES / zh-Hans). Alone-OK beside #1150 / #1151 / #1148 / #1149 / #1071 / #1154 (no migration). Distinct from Activity hub row `event.summary` (#1150 / MISE-005YR) and Restaurant Memory evidence `entry.summary` (#1154 / MISE-005YV).

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still rendered as the evidence Text body with no localized none fallback
- `"\u2003On-hand coverage below reorder point for Chicken Breast.\u2003".trim() === "On-hand coverage below reorder point for Chicken Breast."` inventing equality
- ASCII C soft-null restores `activity.evidence.summary.none`

## Leave alone

- Activity hub row event.summary (#1150 / MISE-005YR)
- Home ActivityRow event.summary (#1151 / MISE-005YS)
- Activity hub row event.title (#1148 / MISE-005YP)
- Home ActivityRow event.title (#1149 / MISE-005YQ)
- Activity expand a11y event.title (#1071 / MISE-005XK)
- Restaurant Memory evidence entry.summary (#1154 / MISE-005YV)

## Alone-OK

No migration. Beside #1150 / #1151 / #1148 / #1149 / #1071 / #1154. Ordinary UI conflicts possible with Activity inventing stacks that also touch `app/more/activity.tsx`.

## Verification

- Focused `activityEvidenceSummaryAsciiC` 5/5 (61 assertion call sites; plan from source)
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm run design:static`
- `npm test`

No migration. Docker pgTAP not run in this environment.

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.

# MISE-005AAQ: pin Daily Brief Board affectedWorkflow to ASCII C

Date: 2026-11-09  
Branch: `cursor/mise-daily-brief-board-affected-workflow-ascii-c`  
Classification: controlled pilot-ready integrity tip (not App Store submission-ready)

## Problem

Daily Brief Board always passed raw `finding.affectedWorkflow` into workflow
meta copy:

```tsx
t("dailyBrief.workflow", { workflow: finding.affectedWorkflow })
```

`affectedWorkflow` is typed as free-form `string`. Writers include ad-hoc
workflow tokens and a direct `insight.insight_type` passthrough, so this is not
a controlled-enum presentation path. Unicode-only-space workflows rendered
blank-looking identity (`"Workflow:  "`). Unicode `.trim()` on padded workflows
would invent clean display equality.

## Fix

- Add `presentationDailyBriefBoardAffectedWorkflowIdentity.ts` with ASCII-only
  end trim, Unicode-padding soft-null, and full C0/DEL rejection.
- Soft-null unsafe workflows to localized `dailyBrief.workflow.none`
  (EN / ES / zh-Hans).
- Leave Board title / explanation / recommendedAction / annotation / missingData
  / a11y title interpolations as raw pass-through on this tip.

## Inventing / bypass proof

- `"\u2003inventory_and_ordering\u2003".trim() === "inventory_and_ordering"`
- `"\u2003"` previously forced blank-looking workflow meta identity
- Free-form beyond controlled enums: `affectedWorkflow: string` plus
  `insight.insight_type` passthrough and ad-hoc literals
  (`inventory_and_ordering`, `daily_sales_import`, `inventory_setup`,
  `recipe_mapping`)
- ASCII C soft-null restores `dailyBrief.workflow.none`

## Verification

- Focused `dailyBriefBoardAffectedWorkflowAsciiC` 5/5 (73 assertion call sites from source)
- `npm run typecheck`
- `npm test`

## Alone-OK

Beside #1145 / #1142 / #1143 / #1144 / #1180 / #1075 / #1074 (ordinary conflict
only on `DailyBriefBoard.tsx` + new identity module + catalog keys; no
migration).

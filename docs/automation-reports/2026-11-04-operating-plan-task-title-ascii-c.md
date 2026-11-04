# MISE-005XQ Operating Plan Timeline a11y presentation.title ASCII C

Date: 2026-11-04

## Gap

Today's OperatingPlanTimeline always passed raw `presentation.title` into
`t("today.task.accessibility", { title, detail, action })`. Operator-authored
restaurant-task titles and descriptor-less operational Today titles flow through
`presentOperatingPlanItem` without soft-null. Empty / Unicode-only-space titles
are non-nullish (and Unicode-only-space is truthy), so VoiceOver / TalkBack
labels could include blank-looking task identity with no intentional localized
none marker. Unicode `.trim()` on padded titles would invent a clean task label.

## Change

- Add `normalizeOperatingPlanTaskTitle` (ASCII end trim; soft-null Unicode
  padding / controls; preserve NBSP — no fold)
- Route timeline-row a11y `presentation.title` through soft-null before
  `|| t("today.task.title.none")`
- Add EN / ES / zh-Hans `today.task.title.none`
- Focused inventing / bypass proofs in
  `tests/operatingPlanTaskTitleAsciiC.test.ts`

## Ownership

Owns only Operating Plan Timeline a11y
**title → today.task.title.none**.
Leaves timeline display Text `{presentation.title}`,
`presentation.detail` a11y chrome, `actionLabel` a11y chrome, Create Task
list-row a11y title (#1072), Activity expand a11y title (#1071), Daily Phase
Brief finding-row a11y title (#1076), and Home ApprovalsSection card.title
(#1049) alone.

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.

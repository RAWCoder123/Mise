# MISE-005XR Operating Plan Timeline a11y presentation.detail ASCII C

Date: 2026-11-04

## Gap

Today's OperatingPlanTimeline always passed raw `presentation.detail` into
`t("today.task.accessibility", { title, detail, action })`. Operator-authored
restaurant-task details and operational Today details flow through
`presentOperatingPlanItem` without soft-null. Empty / Unicode-only-space details
are non-nullish (and Unicode-only-space is truthy), so VoiceOver / TalkBack
labels could include blank-looking task detail with no intentional localized
none marker. Unicode `.trim()` on padded details would invent a clean detail
label.

## Change

- Add `normalizeOperatingPlanTaskDetail` (ASCII end trim; soft-null Unicode
  padding / controls; preserve NBSP — no fold)
- Route timeline-row a11y `presentation.detail` through soft-null before
  `|| t("today.task.detail.none")`
- Add EN / ES / zh-Hans `today.task.detail.none`
- Focused inventing / bypass proofs in
  `tests/operatingPlanTaskDetailAsciiC.test.ts`

## Ownership

Owns only Operating Plan Timeline a11y
**detail → today.task.detail.none**.
Leaves timeline display Text `{presentation.title}`,
`presentation.title` a11y chrome (#1077), `actionLabel` a11y chrome, Create Task
list-row a11y title (#1072), Activity expand a11y title (#1071), Daily Phase
Brief finding-row a11y title (#1076), and Home ApprovalsSection card.title
(#1049) alone.

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.

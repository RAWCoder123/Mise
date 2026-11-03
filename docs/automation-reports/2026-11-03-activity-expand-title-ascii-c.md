# MISE-005XK Activity expand a11y event.title ASCII C

Date: 2026-11-03

## Gap

Activity hub always passed raw `event.title` into
`t("activity.expand.accessibility", { title: event.title })`. Empty /
Unicode-only-space titles are non-nullish (and Unicode-only-space is truthy),
so VoiceOver / TalkBack labels could include blank-looking activity identity
with no intentional localized none marker. Unicode `.trim()` on padded titles
would invent a clean activity label.

## Change

- Add `normalizeActivityExpandTitle` (ASCII end trim; soft-null Unicode
  padding / controls; preserve NBSP — no fold)
- Route expand a11y `title` through soft-null before
  `|| t("activity.expand.title.none")`
- Add EN / ES / zh-Hans `activity.expand.title.none`
- Focused inventing / bypass proofs in
  `tests/activityExpandTitleAsciiC.test.ts`

## Ownership

Owns only Activity expand a11y **title → activity.expand.title.none**. Leaves
Activity row display Text `{event.title}`, Activity subtitle restaurant.name
(#1041), create-task list row a11y `task.title`, and Home ApprovalsSection
card.title (#1049) alone.

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.

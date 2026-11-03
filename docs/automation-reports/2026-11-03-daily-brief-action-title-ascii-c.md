# MISE-005XN Daily Brief action a11y finding.title ASCII C

Date: 2026-11-03

## Gap

Daily Brief action buttons always passed raw `finding.title` into
`t("dailyBrief.approveAccessibility" | "dailyBrief.editAccessibility" |
"dailyBrief.dismissAccessibility", { title: finding.title })`. Empty /
Unicode-only-space titles are non-nullish (and Unicode-only-space is truthy),
so VoiceOver / TalkBack labels could include blank-looking finding identity
with no intentional localized none marker. Unicode `.trim()` on padded titles
would invent a clean finding label.

## Change

- Add `normalizeDailyBriefActionTitle` (ASCII end trim; soft-null Unicode
  padding / controls; preserve NBSP — no fold)
- Route approve / edit / dismiss a11y `title` through soft-null before
  `|| t("dailyBrief.action.title.none")`
- Add EN / ES / zh-Hans `dailyBrief.action.title.none`
- Focused inventing / bypass proofs in
  `tests/dailyBriefActionTitleAsciiC.test.ts`

## Ownership

Owns only Daily Brief action a11y **title → dailyBrief.action.title.none**.
Leaves Daily Brief card display Text `{finding.title}`, card header
accessibilityLabel template `${finding.title}. ${severityLabel}`,
`app/more/daily-brief.tsx` finding title chrome, Daily Brief recommended-action
edits (#884), Activity expand a11y title (#1071), Create Task list-row a11y
title (#1072), and Home ApprovalsSection card.title (#1049) alone.

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.

# MISE-005XO Daily Brief card header a11y finding.title ASCII C

Date: 2026-11-03

## Gap

Daily Brief always passed raw `finding.title` into the card header
accessibility template `` `${finding.title}. ${severityLabel}` ``. Empty /
Unicode-only-space titles are non-nullish (and Unicode-only-space is truthy),
so VoiceOver / TalkBack labels could include blank-looking finding identity
with no intentional localized none marker. Unicode `.trim()` on padded titles
would invent a clean finding label.

## Change

- Add `normalizeDailyBriefCardHeaderTitle` (ASCII end trim; soft-null Unicode
  padding / controls; preserve NBSP — no fold)
- Route card header a11y `finding.title` through soft-null before
  `|| t("dailyBrief.cardHeader.title.none")`
- Add EN / ES / zh-Hans `dailyBrief.cardHeader.title.none`
- Focused inventing / bypass proofs in
  `tests/dailyBriefCardHeaderTitleAsciiC.test.ts`

## Ownership

Owns only Daily Brief card header a11y **title → dailyBrief.cardHeader.title.none**.
Leaves card display Text `{finding.title}`, Daily Brief action a11y title
(#1074), `app/more/daily-brief.tsx` finding title chrome, Daily Brief
recommended-action edits (#884), Activity expand a11y title (#1071), Create
Task list-row a11y title (#1072), and Home ApprovalsSection card.title (#1049)
alone.

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.

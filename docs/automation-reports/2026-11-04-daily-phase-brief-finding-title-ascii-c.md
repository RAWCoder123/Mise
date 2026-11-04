# MISE-005XP Daily Phase Brief finding-row a11y finding.title ASCII C

Date: 2026-11-04

## Gap

Daily Phase Brief always passed raw `finding.title` into the FindingRow
accessibility template `` `${finding.title}. ${finding.interpretation}` ``.
Empty / Unicode-only-space titles are non-nullish (and Unicode-only-space is
truthy), so VoiceOver / TalkBack labels could include blank-looking finding
identity with no intentional localized none marker. Unicode `.trim()` on padded
titles would invent a clean finding label.

## Change

- Add `normalizeDailyPhaseBriefFindingTitle` (ASCII end trim; soft-null Unicode
  padding / controls; preserve NBSP — no fold)
- Route finding-row a11y `finding.title` through soft-null before
  `|| t("dailyPhaseBrief.finding.title.none")`
- Add EN / ES / zh-Hans `dailyPhaseBrief.finding.title.none`
- Focused inventing / bypass proofs in
  `tests/dailyPhaseBriefFindingTitleAsciiC.test.ts`

## Ownership

Owns only Daily Phase Brief finding-row a11y
**title → dailyPhaseBrief.finding.title.none**.
Leaves finding-row display Text `{finding.title}`, finding.interpretation a11y
chrome, Daily Brief card header a11y title (#1075), Daily Brief action a11y
title (#1074), Daily Brief recommended-action edits (#884), Activity expand a11y
title (#1071), Create Task list-row a11y title (#1072), and Home ApprovalsSection
card.title (#1049) alone.

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.

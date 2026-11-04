# MISE-005XY: pin Daily Phase Brief finding-row a11y finding.interpretation to ASCII C

Date: 2026-11-04

## Defect

Daily Phase Brief FindingRow accessibility always passed raw
`finding.interpretation` into
`` `${finding.title}. ${finding.interpretation}` ``. Empty and
Unicode-only-space interpretations are non-nullish (and Unicode-only-space is
truthy), so VoiceOver / TalkBack could announce blank-looking finding detail
with no intentional localized none marker. Separately, Unicode `.trim()` on
NBSP / em-space padding would invent a clean a11y interpretation token.

## Fix

- Soft-null via `normalizeDailyPhaseBriefFindingInterpretation` (ASCII C
  single-line: end trim only; preserve NBSP; full C0/DEL reject).
- Soft-null falls through to localized
  `t("dailyPhaseBrief.finding.interpretation.none")` (EN/ES/zh-Hans).

## Alone-OK

Leave display Text `{finding.interpretation}`, finding.title a11y chrome
(#1076), Daily Brief card header a11y title (#1075), Daily Brief action a11y
title (#1074), Operating Plan Timeline a11y detail (#1078), Activity expand
a11y title (#1071), and Create Task list-row a11y title (#1072) alone.

## Verification

- Focused `tests/dailyPhaseBriefFindingInterpretationAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`

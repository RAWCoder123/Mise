# MISE-005YY: Daily Phase Brief FindingRow finding.interpretation display ASCII C

**Date:** 2026-11-07  
**Branch:** `cursor/mise-daily-phase-brief-finding-interpretation-display-ascii-c`  
**Classification:** controlled pilot-ready integrity tip (not App Store submission-ready)

## Problem

Daily Phase Brief FindingRow always passed raw `finding.interpretation` into
`<Text style={styles.findingBody}>{finding.interpretation}</Text>`.

Empty string and Unicode-only-space interpretations (`"\u2003"`) are non-nullish
(and Unicode-only space is truthy), so blank-looking interpretation bodies
rendered with no intentional localized none marker. Separately, Unicode
`.trim()` on padded interpretations would invent a clean finding detail token
before display.

## Solution

- Add `normalizeDailyPhaseBriefFindingInterpretationDisplay` with multiline
  operator_note allowlist (fold NBSP; C-locale end trim; allow LF/TAB/CR; reject
  other C0/DEL; soft-null em-space padding that would invent trim equality).
- Route FindingRow findingBody `finding.interpretation` through soft-null before
  `|| t("dailyPhaseBrief.findingInterpretation.none")`.
- Add EN / ES / zh-Hans `dailyPhaseBrief.findingInterpretation.none`.

## Ownership

Owns only Daily Phase Brief FindingRow display **interpretation →
dailyPhaseBrief.findingInterpretation.none**. Leaves finding-row a11y
interpretation (#1085), finding.title display (#1156), finding.title a11y
(#1076), Daily Brief Board explanation (#1142), and Board finding.title
(#1145) alone.

## Verification

- Focused `tests/dailyPhaseBriefFindingInterpretationDisplayAsciiC.test.ts` 5/5
  (61 assertion call sites counted from source)
- `npm run typecheck` passed
- `npm run security:static` + `security:backend` + `design:static` passed
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled (inherited
  recalculationCycles hung-timeout cancellations; unrelated)
- No migration

## Distinct from

- #1085 a11y interpretation (single-line full cntrl; different module + i18n key)
- #1156 FindingRow title display
- #1142 Board explanation display (different surface)

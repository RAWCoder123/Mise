# MISE-005PB wasteAnalysis note ASCII C free-text prep

**Date:** 2026-10-13  
**Branch:** `cursor/mise-waste-analysis-note-ascii-c`  
**Base:** `origin/main` @ `78da737`

## Inventing proof

Domain `noteFromMetadata` / `buildWasteAnalysis` Unicode-trimmed waste-event
`metadata.note` via `note.trim().slice(0, 500)` before returning recent-event
presentation. Em-space padding invented a clean free-text body
(`'\u2003Spill during prep\u2003'.trim() === 'Spill during prep'`).

ASCII C multiline free-text prep (NBSP fold + C-end trim only; preserve
internal LF/TAB/CR) leaves em-space alone and does not invent equality with the
unpadded note. Soft empty / Unicode-only spaces → `null`. Soft presentation
keeps the prior 500-character truncate. Normalize helper refuses
control / over-long(>500) / non-string.

## Change

- `services/domain/wasteAnalysisNoteIdentity.ts`
- Route `noteFromMetadata` via `canonicalizeWasteAnalysisNote`
- Left `input.restaurantId.trim()` and timezone emptiness-only alone
- Left `deliveryHistoryMerge` `noteFromMetadata` alone (sibling presentation helper)

## Verification

- Focused AsciiC + wasteAnalysis: 11/11 pass
- `npm run typecheck` pass
- `npm run security:static` / `security:backend` pass
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled (inherited recalculationCycles timer flake)
- Docker pgTAP unavailable in this environment

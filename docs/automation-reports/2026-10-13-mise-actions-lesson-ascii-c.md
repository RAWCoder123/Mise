# MISE-005OU mise-actions lesson ASCII C

Date: 2026-10-13  
Branch: `cursor/mise-actions-lesson-ascii-c`  
Base: `origin/main` @ `78da737`

## Summary

Pins domain-layer mise-actions `measureOutcome` `lesson` to ASCII C multiline
free-text prep so Unicode trim cannot invent a clean durable outcome lesson
via NBSP/em-space padding.

## Inventing proof

`measureOutcome` used `input.lesson?.trim() || null` before storing the durable
outcome lesson field. Em-space padding invented a clean lesson:

```text
'\u2003Ordering before the cutoff protected dinner availability.\u2003'.trim()
  === 'Ordering before the cutoff protected dinner availability.'
```

ASCII C prep (NBSP fold + C end-trim only; no internal `\s` collapse) leaves
em-space alone and keeps internal LF/TAB/CR.

## Change

- `services/domain/miseActionsLessonIdentity.ts`
- Route `measureOutcome` through `normalizeCanonicalMiseActionsLesson`
- Soft empty / Unicode-only spaces still soft-null
- Left `markFailed` `error` Unicode trim alone (open tip #828 / MISE-005OT)
- Left hydrate `error_message` pass-through, `requestedBy` pass-through, and
  restaurantMemory lesson consumers alone

## Verification

- `npm run typecheck`: passed
- focused `miseActionsLessonAsciiC` + `miseActions`: 10/10 passed
- `npm run security:static`: passed
- `npm run security:backend`: passed
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled
- Docker pgTAP unavailable in this environment

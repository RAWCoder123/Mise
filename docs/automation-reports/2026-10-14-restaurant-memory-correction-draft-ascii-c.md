# MISE-005PN restaurant-memory UI correction draft ASCII C

Date: 2026-10-14  
Branch: `cursor/mise-restaurant-memory-correction-draft-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

Restaurant-memory UI
`(correctionDrafts[memory.id] ?? memory.statement).trim()` Unicode-trimmed
correction drafts before emptiness checks and
`updateRestaurantMemoryDecision`. Em-space padding invented a clean free-text
correction before the decision path received it
(`'\u2003Friday dinner runs hot on chicken\u2003'.trim() ===
'Friday dinner runs hot on chicken'`).

## Change

- Add `services/domain/restaurantMemoryCorrectionDraftIdentity.ts` with ASCII C
  multiline free-text prep (NBSP fold + C-end trim only; preserve internal
  LF/TAB/CR).
- Route `app/more/restaurant-memory.tsx` through soft
  `canonicalizeRestaurantMemoryCorrectionDraft` (empty → `null` keeps
  `memory.notice.correctionRequired`; em-space padding no longer invents a
  clean correction).
- Leave domain `boundedStatement` / hydrate `row.correction?.trim()` /
  statement tip #830 / MISE-005OV, scope/source tip #841, and user profile
  display-name trim alone.
- Focused inventing proofs in
  `tests/restaurantMemoryCorrectionDraftAsciiC.test.ts`.

## Verification

- Focused AsciiC: 4/4 pass
- `npm run typecheck`: passed
- `npm run security:static` / `security:backend`: passed
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled
- Docker pgTAP unavailable in this environment

## Merge note

Alone-OK with #830. Keep module separate from
`restaurantMemoryStatementIdentity.ts`. When landing with #830, prefer sharing
one statement/correction canonicalize only after both tips land; until then do
not rewrite domain `boundedStatement` from this tip.

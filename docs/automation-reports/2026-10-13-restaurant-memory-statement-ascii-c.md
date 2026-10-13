# MISE-005OV restaurant-memory statement ASCII C

Date: 2026-10-13  
Branch: `cursor/mise-restaurant-memory-statement-ascii-c`  
Base: `origin/main` @ `78da737`

## Summary

Pins domain-layer restaurant-memory `statement` (create / correct / outcome
lesson consumers / hydrate correction preference) to ASCII C multiline
free-text prep so Unicode trim and `\s` collapse cannot invent a clean durable
memory statement via NBSP/em-space padding.

## Inventing proof

`boundedStatement` used `value.trim().replace(/\s+/g, " ")` before storing the
durable statement. `createMemoryFromOutcome` Unicode-trimmed
`options.statement` / `outcome.lesson`, and hydrate Unicode-trimmed
`row.correction`. Em-space padding invented a clean statement:

```text
'\u2003Friday dinner demand is typically 18% higher.\u2003'.trim().replace(/\s+/g, " ")
  === 'Friday dinner demand is typically 18% higher.'
```

ASCII C prep (NBSP fold + C end-trim only; no internal `\s` collapse) leaves
em-space alone and keeps internal LF/TAB/CR.

## Change

- `services/domain/restaurantMemoryStatementIdentity.ts`
- Route `boundedStatement` through `requireCanonicalRestaurantMemoryStatement`
- Route `createMemoryFromOutcome` lesson/statement selection through
  `normalizeCanonicalRestaurantMemoryStatement`
- Route hydrate correction preference through
  `normalizeCanonicalRestaurantMemoryStatement`
- Soft empty / Unicode-only spaces still soft-null on optional selection /
  hydrate; create/correct stay hard-required; write cap remains 320
- Left `requireRestaurantId` / `scope` / `source` Unicode trim,
  learning-signal label/detail filters, hydrate `correctionNote` raw
  pass-through, and main `measureOutcome` lesson Unicode trim alone
  (open tip #829 / MISE-005OU)

## Verification

- `npm run typecheck`: passed
- focused `restaurantMemoryStatementAsciiC` + `restaurantMemory`: 7/7 passed
- `npm run security:static`: passed
- `npm run security:backend`: passed
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled
- Docker pgTAP unavailable in this environment

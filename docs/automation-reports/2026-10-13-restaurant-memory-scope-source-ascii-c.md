# MISE-005PG restaurantMemory scope/source ASCII C identity prep (2026-10-13)

## Inventing proof

Domain `createMemory` Unicode-trimmed `scope` / `source` with soft-empty defaults
(`(input.scope ?? "restaurant").trim() || "restaurant"` and the matching
`mise_learning` source default). Em-space / NBSP padding invented a clean
durable key (`'\u2003restaurant\u2003'.trim() === 'restaurant'`,
`'\u2003mise_learning\u2003'.trim() === 'mise_learning'`).

ASCII C identity prep (ASCII end trim only; fail closed when Unicode trim would
still strip end padding) leaves em-space / NBSP alone and does not invent
equality with the unpadded key. Soft empty / Unicode-only spaces stay soft-null
so create can fall through to the prior defaults without inventing those
defaults from a padded real token. Hydrate requires a canonical present token
and fails closed on soft empty rather than inventing create-time defaults.

## Change

- `services/domain/restaurantMemoryScopeSourceIdentity.ts`
- Route `createMemory` scope/source via `normalizeCanonicalRestaurantMemoryScope` /
  `normalizeCanonicalRestaurantMemorySource` with prior defaults
- Route hydrate via `requireCanonicalRestaurantMemoryScope` /
  `requireCanonicalRestaurantMemorySource`
- Left `requireRestaurantId`, `boundedStatement` / statement free-text,
  learning-signal `label`/`detail` filters, and hydrate
  `correction`/`correctionNote` alone (statement inventing stays with #830 /
  MISE-005OV)

## Verification

- focused AsciiC + restaurantMemory: 7/7 pass
- `npm run typecheck` pass
- `npm run security:static` / `security:backend` pass
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled
- Docker pgTAP unavailable in this environment

## Merge

Alone-OK. Keep module separate from #830 statement free-text, #699 learning-signal
classify, and SQL scope/source cntrl pins #511 / #566. When landing with sibling
tips, drop mutual Unicode-trim cross-assertions.

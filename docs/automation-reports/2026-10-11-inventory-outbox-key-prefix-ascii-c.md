# MISE-005NE: pin inventory outbox keyPrefix to ASCII C

## Summary

Unicode `keyPrefix.trim()` emptiness in `inventoryOutboxRepository.storageKey`
accepted NBSP/em-space-padded prefixes and built a parallel AsyncStorage
partition beside the unpadded default. This tip pins the prefix through
ASCII-C canonicalize and preserves `missing_outbox_key_prefix`.

## Inventing proof

On `origin/main` before this tip:

```text
'\u00a0mise.inventory-outbox.v1\u00a0'.trim() === 'mise.inventory-outbox.v1'
Boolean(padded.trim()) === true
storage key became `${padded}:${restaurantId}` (distinct from canonical)
```

ASCII-C canonicalize returns `null` for the same padded input and
`storageKey` rejects with `missing_outbox_key_prefix` before any storage I/O.

## Changes

- `services/domain/inventoryOutboxKeyPrefixIdentity.ts` — ASCII trim +
  canonicalize + require
- `services/repositories/inventoryOutboxRepository.ts` — wire
  `requireCanonicalInventoryOutboxKeyPrefix` into `storageKey`
- `tests/inventoryOutboxKeyPrefixAsciiC.test.ts` — inventing + contract proofs

## Left alone

- Inventory outbox entry-id tip #784 / `inventoryOutboxIdentity`
- Finding-decision outbox key-prefix tip #786
- Restaurant-id regex gate on the same `storageKey` path

## Verification

- `npm run typecheck` — passed
- focused `inventoryOutboxKeyPrefixAsciiC` — 4/4 (+ related `inventoryOutboxRepository` suite green)
- `npm run security:static` / `npm run security:backend` — passed
- `npm test` — 687 total / 680 pass / 0 fail / 7 cancelled (pre-existing `recalculationCycles` timeout flake)

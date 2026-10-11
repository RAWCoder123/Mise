# MISE-005NB inventory outbox entry id ASCII C

Date: 2026-10-11  
Branch: `cursor/mise-inventory-outbox-id-ascii-c`  
Base: `origin/main` @ `78da737`

## Change

Pins domain `createInventoryOutboxEntry` `id` to ASCII-only end trim so
NBSP/em-space padding cannot invent a normalized outbox entry identity before
create, sort, or device persist.

- Adds `services/domain/inventoryOutboxIdentity.ts` with fail-closed
  canonicalize / require helpers.
- Routes `createInventoryOutboxEntry` through
  `requireCanonicalInventoryOutboxId`, preserving `missing_outbox_id`.
- Stores the canonicalized id (ordinary ASCII padding collapses; Unicode
  padding fails closed).
- Leaves `input.event.clientEventId.trim()` /
  `input.event.idempotencyKey.trim()` on Unicode trim (owned by #771 /
  MISE-005MO).
- Non-UUID demo/test tokens intentionally preserved (no UUID shape gate).
- Max length 128 matches sibling object-identity tips.

## Inventing proof

`'\u00a0outbox-1\u00a0'.trim() === 'outbox-1'` while ASCII-C canonicalize
returns `null` and create rejects with `missing_outbox_id`. On current main,
create previously stored the padded id as a parallel entry identity beside the
unpadded token.

## Merge note

Land alone-OK relative to #771/#782/#783. When #771 also lands, keep outbox
entry-id canonicalize separate from ledger object canonicalize; drop any
assertion that outbox `id` still Unicode-trims. Do not merge error contracts
with ledger object / restaurant / source tips.

## Verification

- `tests/inventoryOutboxIdAsciiC.test.ts`: focused inventing proofs
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`

## Do not

- Re-tip this inventory outbox entry-id path after merge.
- Bundle ledger object (#771), restaurant (#782), or source (#783) in the same PR.
- Rewrite event `clientEventId` / `idempotencyKey` Unicode trim in this tip.
- Add a UUID shape requirement on this object path (tests/demo may use non-UUID tokens).

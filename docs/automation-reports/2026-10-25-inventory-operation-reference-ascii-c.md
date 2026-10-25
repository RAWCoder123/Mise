# MISE-005PU inventory-operation sourceReference / reasonCode ASCII C

Date: 2026-10-25  
Branch: `cursor/mise-inventory-operation-reference-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

miseValidation `requireInventoryOperation` routed `sourceReference` and
`reasonCode` through `optionalBoundedText` Unicode `.trim()`. Em-space / NBSP
padding invented clean durable ledger evidence tokens before the event was
stored (`'\u2003invoice-42\u2003'.trim() === 'invoice-42'` and
`'\u2003delivery\u2003'.trim() === 'delivery'`).

## Change

- Add `INVENTORY_OPERATION_SOURCE_REFERENCE_MAX_CHARACTERS = 200` and
  `INVENTORY_OPERATION_REASON_CODE_MAX_CHARACTERS = 80` to
  `services/domain/securityLimits.ts`.
- Add `services/domain/inventoryOperationReferenceIdentity.ts` with ASCII C
  single-line identity prep (ASCII end trim only; fail closed when Unicode
  trim would still strip end padding; full C0/DEL control rejection).
- Route `requireInventoryOperation` reference/reason through fail-closed
  `normalizeCanonicalInventoryOperationSourceReference` /
  `normalizeCanonicalInventoryOperationReasonCode` (soft empty → `null`;
  over-long keeps the prior `Enter a shorter reference.` /
  `Enter a shorter reason.` messages; unsafe controls / Unicode-padded
  tokens fail closed with `Enter a valid reference.` /
  `Enter a valid reason.`).
- Leave `note` on `optionalBoundedText` Unicode trim (open #854 / MISE-005PT
  owns the inventory-operation note path), and leave count-line /
  count-session / supplier operator_note / restaurant-memory scope-source
  tips alone.
- Focused inventing proofs in
  `tests/inventoryOperationReferenceAsciiC.test.ts`.

## Verification

- Focused AsciiC: see commit evidence
- `npm run typecheck` pass
- `npm run security:static` / `security:backend` pass
- `npm test`: see commit evidence
- Docker pgTAP unavailable in this environment

## Merge note

Alone-OK. Keep module separate from inventory-operation note (#854 /
MISE-005PT), inventory count-line note (#827 / #846), count-session note
(#845), supplier operator_note (#840), and restaurant-memory scope/source
(#841). When landing with #854, drop #854's assertion that
`sourceReference` / `reasonCode` still call `optionalBoundedText`, and drop
this tip's assertion that `note` still calls `optionalBoundedText`.

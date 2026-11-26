# Purchase-line supersede target evidence (2026-11-26)

## Gap

`purchase_lines.supersedes_line_id` only required a same-restaurant FK, a
non-self link, and `revision > 0`. Hosted `supersede_purchase_line` already
inherits supplier, document reference, line index, line type, and
`revision = target.revision + 1`, but direct inserts that satisfy the soft
CHECKs could stamp a forged successor onto a different supplier, document,
line index, or line type inside the same restaurant, or with a non-contiguous
revision.

Netting excludes superseded lines. A forged successor therefore hides real
purchase history from current nets while claiming durable correction evidence.

## Change

- Domain: `validatePurchaseLineSupersedeTargetEvidence` with
  `supersede_target_*` rejection codes
- Additive BEFORE INSERT tip
  `private.enforce_purchase_line_supersede_target_evidence`
- No table CHECK (cross-row identity cannot be expressed as a CHECK; same shape
  as the `credits_line_id` target tip)
- pgTAP plan=12 (direct reject/accept paths + RPC supersede accept + second
  supersession still fail-closed)

## Alone-OK

Orthogonal to purchase-line product #1238/#1250–#1258 (including UI correction
#1253, which has no migration), unpadded tips #1283–#1286, consistency-flags
#1287, credit-link #1288, credit-memo line-type #1289, inventory tips
#1259–#1282, and locale pins. Does not rewrite ingest/append/supersede RPCs.

## Verification

- `npm run typecheck`
- focused suite `tests/purchaseLineSupersedeTargetEvidence.test.ts`
- `npm test`
- `npm run security:static` / `security:backend` / `design:static`

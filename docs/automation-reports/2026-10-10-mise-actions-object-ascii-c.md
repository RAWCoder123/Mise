# MISE-005ME: pin Mise-actions orderId/actionId to ASCII C

Date: 2026-10-10  
Branch: `cursor/mise-actions-object-ascii-c`  
Base: `origin/main` @ `78da737`

## Change

Pins Mise-actions application `orderId` / `actionId` object tokens to ASCII-only
end trim so NBSP/em-space padding cannot invent a normalized identity before
supplier-send lookup or approval writes.

- Adds `services/domain/miseActionsObjectIdentity.ts` with fail-closed
  canonicalize/require helpers.
- Routes `fetchSupplierSendAction` `orderId` through
  `requireCanonicalMiseActionsObjectId(..., "supplier order")`.
- Routes `requireSupplierSendApprovalId` labels `"supplier order"` and
  `"supplier send action"` through the same helper.
- Preserves `Missing supplier order.` / `Missing supplier send action.`
- Leaves restaurant workspace on Unicode trim (owned by #738 / MISE-005LH).
- Leaves `decideMiseAction` raw `actionId` pass-through (no Unicode trim
  inventing surface today).
- Non-UUID demo tokens intentionally preserved (no UUID shape gate).

## Merge note

When landing with #738, keep both restaurant and object branches in
`miseActions.ts`. Drop any assertion that object `orderId` /
`requireSupplierSendApprovalId` still uses Unicode `value.trim()` for
`"supplier order"` / `"supplier send action"`; this tip owns those object
identities. #738 owns restaurant `Missing restaurant workspace.`

## Verification

- `tests/miseActionsObjectAsciiC.test.ts`: 4/4
- `tests/miseActions.test.ts`: 5/5
- `npm run typecheck`: pass
- `npm run security:static` / `security:backend`: pass
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (pre-existing recalculationCycles)

## Do not

- Re-tip this Mise-actions orderId/actionId object path after merge.
- Bundle restaurant (#738) or sibling object tips in the same PR.
- Rewrite restaurant `restaurantId.trim()` / `"restaurant workspace"` in this tip.
- Add UUID shape requirement on this object path (demo may use non-UUID tokens).

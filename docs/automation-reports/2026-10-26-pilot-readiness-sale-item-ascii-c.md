# MISE-005QO pilot readiness missing-recipe sale item ASCII C

Tip branch: `cursor/mise-pilot-readiness-sale-item-ascii-c`

## Inventing proof

`assessRecipeCoverage` Unicode-trimmed POS `sale.item_name` before inserting
into the missing-recipe blocker Set
(`'\u2003Wings\u2003'.trim() === 'Wings'`). Padded unmapped sales therefore
invented equality with clean menu-item blocker keys.

## Change

- Add `services/domain/pilotReadinessSaleItemIdentity.ts` with ASCII-only end
  trim, fail-closed canonicalize, and soft normalize (MISE-005QO).
- Route missing-name Set keys through `normalizePilotReadinessSaleItemName`,
  filtering soft-empty results so padded/control tokens do not invent a clean
  Set entry.
- Leave `restaurantId.trim()` (#745), `supplier_id.trim()` (#826), Insights
  sales labels (#869), and setup POS itemName (#872) on their own tips.

## Merge notes

Alone-OK relative to #745 / #826 / #869 / #872 / #863. Keep the identity module
separate from those helpers.

## Verification

- `node --test --import tsx tests/pilotReadinessSaleItemAsciiC.test.ts tests/pilotReadiness.test.ts` — 10/10
- `npm run typecheck` — passed
- `npm run security:static` / `npm run security:backend` — passed
- `npm test` — 687 total / 680 pass / 0 fail / 7 cancelled (pre-existing
  `recalculationCycles` `withTimeout` hung-promise `cancelledByParent`)

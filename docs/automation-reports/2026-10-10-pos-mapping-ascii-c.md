# MISE-005MB: pin POS requireWorkflowId mapping and menu item to ASCII C

Date: 2026-10-10  
Branch: `cursor/mise-pos-mapping-ascii-c`  
Base: `origin/main` @ `78da737`

## Problem

`services/application/pos.ts` local `requireWorkflowId(..., "mapping" | "menu item")`
used Unicode `String.trim()`. NBSP / em-space padding around a mapping or
menu-item token such as `mapping-pos-review` or `demo-menu:house salad` would
be stripped, inventing a normalized object identity that matched the unpadded
token.

## Change

- Added `services/domain/posMappingWorkflowIdentity.ts` with ASCII-only end trim
  and fail-closed canonicalize/require helpers.
- Routed only the mapping and menu-item labels of local `requireWorkflowId`
  through `requireCanonicalPosMappingWorkflowId`.
- Preserved `A valid ${label} id is required.` and left the restaurant label on
  Unicode trim (`A valid restaurant id is required.`), owned by #757.

## Intentionally out of scope

- POS `requireWorkflowId` restaurant (#757 / MISE-005MA)
- Orders workflow / authorities restaurant tips (#756 / #754)
- Sibling restaurant workspace tips (#727–#755)
- Orders non-restaurant `requireWorkflowId` labels

## Merge note

When landing with #757, keep both restaurant and mapping/menu-item branches in
`requireWorkflowId`. Drop #757’s static assertion that mapping/menu item still
use Unicode `value.trim()`; this tip owns those labels.

## Verification

- `tests/posMappingWorkflowAsciiC.test.ts`: 4/4 pass
- `tests/posMappingReviewWorkflow.test.ts`: pass (mapping call-site contract retained)
- `npm run typecheck`: pass
- `npm run security:static` / `security:backend`: pass
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (pre-existing `recalculationCycles` cancelledByParent)

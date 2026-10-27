# MISE-005SC demo purchase-recommendation id ASCII C

Date: 2026-10-27  
Branch: `cursor/mise-demo-purchase-recommendation-id-ascii-c`

## Problem

`services/demo/replaceableDemoData.ts` `repairDemoState` fed
`recommendation.id?.trim()` into durable demo `purchaseRecommendations[].id`
values (and collision suffixes). Unicode trim invents a clean recommendation
identity (`'\u2003rec_abc\u2003'.trim() === 'rec_abc'`). Soft empty /
Unicode-only space also invented the legacy-id branch via
`'\u2003'.trim() === ''` falling through to `` `rec_legacy_${index + 1}` `` —
that soft-empty → legacy migration is intentionally preserved; padded non-empty
tokens must not invent a reviewed id.

Open #814 / MISE-005OF pins restaurant-tasks `relatedRecommendationId`.
Open #686 / MISE-005JQ pins replaceableDemo setup/lookup keys. Open #889 /
MISE-005RC pins Orders recommendation quantity drafts. None own this demo
purchase-recommendation id Unicode-trim sink. Tip them separately.

## Change

- New `services/domain/demoPurchaseRecommendationIdIdentity.ts` (MISE-005SC)
- Soft empty / Unicode-only space → null → prior `` `rec_legacy_${index + 1}` ``
- ASCII whitespace still trims clean before durable id
- Unicode end padding and controls → throw
  (`Purchase recommendation id is invalid.`)
- Wire `repairDemoState` recommendation id repair
- Leave #814 / #686 / #889 modules alone

## Landing notes

Alone-OK with #814 / #686 / #889 / #914 / #913 / #905–#907. Keep
`demoPurchaseRecommendationIdIdentity.ts` separate from
`restaurantTasksRelatedRecommendationIdentity.ts` (#814). When landing with
#686 on the same `replaceableDemoData.ts` file, resolve textually; do not
consolidate onto that setup/lookup module in this tip.

## Verification

- focused AsciiC 4/4
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (inherited
  `recalculationCycles` on main; tip +4 vs main ~683)
- Docker pgTAP unavailable in this environment

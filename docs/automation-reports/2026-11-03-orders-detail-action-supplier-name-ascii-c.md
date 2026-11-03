# MISE-005XH: Orders detail action a11y supplier_name ASCII C

Date: 2026-11-03  
Branch: `cursor/mise-orders-detail-action-supplier-name-ascii-c`

## Problem

Orders detail always passed raw `visibleOrder.supplier_name` into copy,
simulate, approve-and-send, and mark-received accessibility interpolations.
Empty and Unicode-only-space names are non-nullish and truthy, so they produced
blank-looking supplier identity inside VoiceOver / TalkBack labels with no
intentional localized none marker. Unicode `.trim()` on padded names would
invent a clean supplier label before interpolation.

## Change

- Add `normalizeOrdersDetailActionSupplierName` (ASCII end trim; soft-null
  Unicode padding / controls; preserve NBSP — no fold).
- Route the four Orders detail action a11y `supplier` interpolations through
  soft-null before `|| t("orders.detail.action.supplier.none")`.
- Add EN / ES / zh-Hans `orders.detail.action.supplier.none`.
- Focused inventing / bypass proofs in
  `tests/ordersDetailActionSupplierNameAsciiC.test.ts`.

## Ownership

Owns only Orders detail action a11y `supplier_name` →
`orders.detail.action.supplier.none` presentation (copy / simulate /
approveAndSend / markReceived). Does **not** own Orders detail Screen title
(#1016), SupplierDraftCard supplier_name (#1050), Orders review supplier_name
(#1051), email-review headers (#1015), email-review body (#1014), note.none
(#1013), operator_note (#840), durable send From/To (#708), durable send
subject (#913), delivery-evidence (#1010), receive-discrepancy (#670), or the
approveAndSend `recipient` interpolation.

Alone-OK relative to #1016 / #1050 / #1051 (different call sites / helpers).

## Verification

- focused tip tests: 5/5
- `npm run typecheck`: passed
- `npm run security:static`: passed
- `npm run security:backend`: passed
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled (inherited `recalculationCycles`)
- Docker pgTAP unavailable in this environment

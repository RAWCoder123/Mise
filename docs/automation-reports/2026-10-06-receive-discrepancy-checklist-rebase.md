# Receive discrepancy checklist — rebased onto current main (2026-10-06)

Branch: `cursor/mise-receive-discrepancy-main-rebase`  
Base: `origin/main` @ `78da7376` (MISE-005A)  
Supersedes: open #182 / stale #134 (same workflow; rebased rather than duplicated)

## Gap

Sent supplier orders could only be marked received as-ordered. The delivery RPC
already accepted damaged/missing/reason fields, but the order-detail UI had no
checklist, so short-ships and damage could not update inventory evidence
correctly from the operator path.

## Change

- Domain: receive preview, `applyDeliveryLineAdjustments`, derived missing qty,
  ASCII-C control scrub on discrepancy reasons (compose with #661 CHECK)
- Application: `previewSupplierOrderDelivery` + `lineAdjustments` on receive
- Order detail UI checklist with EN / ES / zh-Hans copy
- Demo repository persists `discrepancy_reason`
- Focused domain + UI source pins

## Out of scope

- Hosted SQL CHECK pin for `discrepancy_reason` (#661)
- Invoice/PO document references on receive (#381)
- Recipe unlink (#183)
- Live Gmail / POS activation

## Classification

Controlled pilot-ready product tip. Not App Store submission-ready.

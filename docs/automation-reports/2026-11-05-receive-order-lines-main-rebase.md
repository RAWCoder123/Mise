# Receive from durable order lines — main rebase (2026-11-05)

Tip: `cursor/mise-receive-order-lines-main-rebase` stacked on
`cursor/mise-supplier-order-lines-main-rebase` (#1108).
Supersedes stale #197 (`cursor/mise-receive-order-lines` @ `6479c419`).

## What landed

- Cherry-picked #197 onto the current #1108 tip (`5677b713`).
- Receive builds as-ordered quantities from durable `supplier_order_lines`
  snapshots via `buildDeliveryLinesFromSupplierOrderLines`.
- Fail closed when durable lines are missing
  (`SupplierOrderLinesMissingError`) or any ordered line lacks a verified
  canonical unit (`SupplierDeliveryLinesSkippedError`).
- No silent live-recommendation rebuild and no silent partial receive.
- Order detail surfaces EN/ES/zh-Hans notices with Inventory recovery for
  unverified units.
- Gap audit supplier-draft / delivery-outcome rows updated to reflect the
  durable-line cutover; discrepancy checklist remains separate (#670 / #182).

## Why this tip

#1108 dual-writes durable lines on approve/undo/Gmail complete, but receive
still preferred live recommendations until this cutover. Without it, later
recommendation edits can rewrite what was approved or sent before physical
receipt. Highest-impact next tip in the receive integrity chain after #1108.

## Stacking

- Base: `cursor/mise-supplier-order-lines-main-rebase` (#1108).
- Does **not** implement discrepancy checklist UI (#670 / #182).
- Does **not** bind send fingerprints to durable lines (#198).

## Land notes

Do not merge stale #197. Prefer this tip after #1108. Ordinary conflicts
expected with open receive/order UI tips on `app/orders/[id].tsx` and
`i18n/catalog.ts`. Stack #198 after this tip.

## Verification

Recorded in the tip commit message / PR body after gates run.

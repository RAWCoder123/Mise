# Durable structured supplier order lines main rebase (2026-11-05)

Tip: `cursor/mise-supplier-order-lines-main-rebase` — opened onto `origin/main`.
Supersedes stale CONFLICTING #196 (`cursor/mise-supplier-order-lines` @ `25502e24`).

## What landed
- Cherry-picked #196 onto current main (`78da7376`); resolved `scripts/security-backend.mjs` to keep both `purchase_lines` and `supplier_order_lines` in SELECT-only inventory.
- Renamed migration to `20261105080000_supplier_order_lines.sql` so hosted tenants already past MISE-004C still apply it. Wrapper chain renames the live MISE-004A `approve` / `undo` / Gmail-complete surfaces and dual-writes durable lines without replacing authority or decision-memory bodies.
- Domain `buildSupplierOrderLineSnapshots` / demo / repository / export / order-detail UI / EN·ES·zh-Hans copy unchanged in intent from #196.
- Tip report: this file. Original design notes remain in `2026-08-27-supplier-order-lines.md`.

## Why this tip
Approved supplier drafts still lacked a tenant-safe structured line table; receive and send-fingerprint follow-ons (#197/#198) need this substrate. Highest-impact alone-OK migration tip while #1100–#1107 await land; avoids inventing MOQ/lead-time/expiration and does not cut receive over to durable lines yet.

## Land notes
Do not merge stale #196. Prefer this tip. Ordinary conflicts expected with open receive/order UI tips on `app/orders/[id].tsx` and `i18n/catalog.ts`. Stack receive-from-lines (#197) and send fingerprint (#198) after this lands.

## Intentionally deferred
- Point receive at durable lines (#197 / after discrepancy stack).
- Authoritative order totals when costs incomplete.
- Wrap `mark_supplier_order_sent` (approve already freezes lines; Gmail complete refreshes).

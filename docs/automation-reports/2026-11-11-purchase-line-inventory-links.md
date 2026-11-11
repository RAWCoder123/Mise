# Purchase-line → inventory-item links (2026-11-11)

## Summary

Managers can explicitly verify a purchase-line `normalized_item_key` (optionally
supplier-scoped) against a same-tenant inventory item, then optionally apply the
newest confirmed invoice unit price onto `estimated_unit_cost`.

## Why

MISE-004C stores priced invoice lines but never binds them to inventory
identity. Valuation, waste $, supplier spend, and order automation all depend
on `estimated_unit_cost`, which stayed manual or delivery-path-only. This slice
adds the missing manager-verified identity bridge without fuzzy matching or
auto-binding.

## Scope

- Additive table `purchase_line_item_links` (select-only for authenticated)
- SECURITY DEFINER RPCs: link, revoke, apply linked unit cost
- Demo/hosted repository parity
- More → Invoice item links operator UI (EN/ES/zh-Hans)
- Domain exact-match suggestions only
- Security inventory, export dataset, tenant allowlist, route smoke

## Explicit non-goals

- Fuzzy / stemming / cross-supplier inference
- Automatic cost updates without manager confirmation
- Overlap with delivery invoice-cost apply (#353) or manual cost edit (#231)

## Verification

- Focused domain/migration/demo tests
- `npm run typecheck`
- `npm test` (full suite)
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`

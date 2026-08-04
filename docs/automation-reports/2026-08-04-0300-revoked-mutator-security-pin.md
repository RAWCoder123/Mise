# Revoked mutator security pin (2026-08-04)

## Gap
`scripts/security-backend.mjs` skipped DEFINER functions with empty execute roles, so only identities listed in `revokedAuthenticatedMutators` failed closed on accidental re-grant. Eight Edge-revoked legacy mutators remained unpinned, including `mark_supplier_order_sent`, which historically regained `authenticated` EXECUTE during the Gmail migration before a later Edge-ownership revoke.

Matching `service_undo_purchase_recommendation_action`, `service_update_supplier_order_draft`, and `service_mark_supplier_order_sent` wrappers were also missing from `edgeOwnedServicePublicFunctions`, and staging service-RPC forgery probes did not cover dismiss/undo/update-draft/mark-sent. The locale/notification preference staging probe was also arity-broken (two function names in one `assertDeniedRpc` call).

## Change
- Pin eight revoked mutators in `revokedAuthenticatedMutators`:
  - `undo_purchase_recommendation_action`
  - `update_supplier_order_draft`
  - `mark_supplier_order_sent`
  - `replace_pending_purchase_recommendations`
  - `replace_operational_insights`
  - `replace_operational_signals`
  - `update_inventory_item_and_signals`
  - `save_recipe_mapping_and_signals`
- Pin three Edge-owned purchase/order service wrappers in `edgeOwnedServicePublicFunctions`.
- Extend `scripts/staging-service-rpc-check.mjs` with forged actor/tenant denial probes for dismiss, undo, draft update, and mark-sent; repair locale/notification preference probes to call each RPC separately with the correct `P0002` unavailable-profile expectation.
- Extend `tests/security.test.ts` string assertions so the denylist and staging probes cannot regress silently.

## Proof
Synthetic re-grant of `public.mark_supplier_order_sent` to `authenticated` now fails `npm run security:backend` with:
`must remain revoked from authenticated/anon/public after Edge ownership`.

## Verification
- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`

Docker `supabase:test` and hosted staging re-proof remain environment-blocked in this run.

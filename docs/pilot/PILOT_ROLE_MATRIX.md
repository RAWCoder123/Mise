# First restaurant pilot — role matrix

This matrix documents the current intended authority. A check means the role may perform the mutation for its own active restaurant. All roles may read tenant-scoped operator surfaces unless a row explicitly says otherwise.

| Action | Owner | Admin | Manager | Staff | Enforcement path |
| --- | ---: | ---: | ---: | ---: | --- |
| Connect or disconnect Square | ✓ | ✓ | — | — | `link-square`, OAuth service RPCs |
| Sync Square sales | ✓ | ✓ | ✓ | — | `sync-pos-sales` Edge role gate |
| Choose authorized Square locations | — | — | — | — | Not implemented as an operator choice |
| Resolve catalog/menu mapping | — | — | — | — | No operator workflow yet |
| Begin inventory count | ✓ | ✓ | ✓ | ✓ | `operational-workflows` count draft actions |
| Save count lines | ✓ | ✓ | ✓ | ✓ | Count-session service RPC |
| Submit count | ✓ | ✓ | ✓ | ✓ | Count-session service RPC |
| Approve count | ✓ | ✓ | ✓ | — | `service_approve_inventory_count_session` |
| Cancel count | ✓ | ✓ | ✓ | — | Count-session cancellation RPC |
| Edit inventory policy | ✓ | ✓ | ✓ | — | `update_inventory` workflow |
| Verify canonical unit | ✓ | ✓ | ✓ | — | `verify_inventory_item_canonical_unit` |
| Edit recipe mapping | ✓ | ✓ | ✓ | — | `upsert_recipe` workflow |
| Review recommendation | ✓ | ✓ | ✓ | view only | Orders UI + recommendation RPCs |
| Approve or adjust recommendation | ✓ | ✓ | ✓ | — | `approve_purchase_recommendation` |
| Dismiss recommendation | ✓ | ✓ | ✓ | — | `dismiss_purchase_recommendation` |
| Review supplier draft | ✓ | ✓ | ✓ | view only | Tenant-scoped supplier order read |
| Edit supplier draft note/date | ✓ | ✓ | ✓ | — | Supplier-order RPCs |
| Manage supplier recipient | ✓ | ✓ | — | — | `upsert_supplier_recipient` |
| Connect or disconnect Gmail | ✓ | ✓ | — | — | `link-gmail`, OAuth service RPCs |
| Approve/send supplier email | ✓ | ✓ | ✓ | — | `approve_supplier_send_envelope` + `send-supplier-email` claim |
| Record supplier delivery | ✓ | ✓ | ✓ | — | `record_supplier_delivery` |
| Manage autonomy rules | ✓ | ✓ | — | — | Autonomy rule RPC |
| Export restaurant data | ✓ | ✓ | — | — | `export-restaurant-data` |

## Pilot rules

- Staff never approve count adjustments, purchasing recommendations, supplier drafts, or external communications.
- Managers may execute restaurant operations but may not create provider credentials or change recipient identity.
- Owners/admins own Square, Gmail, recipient, export, team, and autonomy configuration.
- Every mutating request derives actor identity from the authenticated session and verifies active membership for the restaurant ID in the request.
- UI visibility is not an authorization boundary; Edge Functions and database RPCs remain authoritative.

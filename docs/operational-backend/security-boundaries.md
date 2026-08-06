# Operational backend security boundaries

Source of truth: `supabase/migrations/20260802204120_operational_backend_foundation.sql`  
Client contract: tenant-scoped SELECT plus authenticated RPCs only. Demo mirrors the decisions locally.

## Table authority

| Table | Authenticated client | Service role |
| --- | --- | --- |
| `operational_issues` | member SELECT only | explicit SELECT/INSERT/UPDATE/DELETE |
| `mise_actions` | member SELECT only | explicit SELECT/INSERT/UPDATE/DELETE |
| `action_outcomes` | member SELECT only; append-only | explicit SELECT/INSERT only |
| `restaurant_memories` | member SELECT; mutate through RPC | explicit SELECT/INSERT/UPDATE/DELETE |
| `restaurant_autonomy_rules` | member SELECT; mutate through RPC | explicit SELECT/INSERT/UPDATE/DELETE |
| `activity_events` | member SELECT only; append-only | explicit SELECT/INSERT only |
| `supplier_order_confirmations` | member SELECT only | explicit SELECT/INSERT/UPDATE/DELETE |
| `supplier_deliveries` / `supplier_delivery_items` | member SELECT; receive through RPC | explicit SELECT/INSERT/UPDATE/DELETE |
| `restaurant_tasks` / `restaurant_task_dependencies` | active-member SELECT; create/complete/reopen through RPC only | explicit SELECT/INSERT/UPDATE/DELETE |

All default/public/anonymous grants are revoked first. No operational table grants
`TRUNCATE`. Every table has membership RLS and the authenticated operational-mode
guard used by read-only/emergency response.

## Authenticated RPCs

| RPC | Role gate | Purpose |
| --- | --- | --- |
| `decide_mise_action` | owner/admin/manager | Approve, reject, cancel, or explicitly retry eligible failed work |
| `update_restaurant_memory` | owner/admin/manager | Confirm, correct, dismiss, forget, or disable a memory |
| `upsert_restaurant_autonomy_rule` | owner/admin | Persist bounded level/approval/spend/supplier/communication/time scope |
| `record_supplier_delivery` | owner/admin/manager | Idempotent delivery → verified inventory receipts → outcome/activity/memory |
| `create_restaurant_task` | active member; staff limited to member-level human work | Create one bounded idempotent shared task plus same-tenant prerequisite edges |
| `complete_restaurant_task` | assignee plus required role | Require prerequisites, result, and configured evidence; complete and unblock dependents atomically |
| `reopen_restaurant_task` | owner/admin/manager | Reopen completed work without erasing immutable activity history |

Each is `SECURITY DEFINER`, pins `search_path = ''`, requires `auth.uid()`, validates
tenant membership/role, and emits durable audit or activity evidence.

## Service-only RPCs

- `service_append_activity_event`: bounded append-only activity
- `service_record_mise_action_failure`: user-visible failed/unverified supplier send
- `service_record_supplier_confirmation`: inbound supplier confirmation authority

Public and private wrappers are revoked from public/anon/authenticated and granted
only to `service_role`. Private trigger helpers are not callable client APIs.

## Supplier send guarantees

- `send_supplier_order:{orderId}` identifies one send action in hosted and demo modes.
- A direct Send press records explicit approval through `decide_mise_action` before provider delivery.
- Rejected/cancelled/reversed actions cannot send.
- Definitive rejection records `failed`; a user may explicitly retry later.
- Ambiguous provider result records `unverified`; automatic retry is blocked to avoid duplicates.
- Live-disabled/configuration/provider/finalization failures create visible action/activity evidence.
- Provider credentials remain in server-side Vault/environment boundaries, never Expo or export payloads.

## Data lifecycle

- Activity events, action outcomes, inventory events, and audit evidence are immutable in normal operation.
- Restaurant export includes the operational-foundation and shared-task tables but excludes credentials and private security logs.
- Whole-tenant deletion follows existing controlled cascade/account-deletion procedures.

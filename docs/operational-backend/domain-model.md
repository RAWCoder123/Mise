# Operational domain model

Authoritative implementation: `services/domain/*` and
`supabase/migrations/20260802204120_operational_backend_foundation.sql`.

| Concept | Pure domain / application | Hosted persistence |
| --- | --- | --- |
| Operational issue | operating-brief and daily-finding inputs | `operational_issues` |
| Activity | `activityEvents.ts`, `application/activity.ts` | append-only `activity_events` |
| Operating brief | `operatingBrief.ts`, `application/operatingBrief.ts` | projection over current tenant evidence |
| Permissioned action | `miseActions.ts`, `application/miseActions.ts` | `mise_actions` + `decide_mise_action` |
| Outcome | `measureOutcome`, delivery application path | append-only `action_outcomes` |
| Restaurant memory | `restaurantMemory.ts`, `application/restaurantMemory.ts` | `restaurant_memories` + correction RPC |
| Autonomy rule | `restaurantAutonomy.ts`, `application/autonomy.ts` | `restaurant_autonomy_rules` + owner/admin RPC |
| Supplier confirmation | repository contract | `supplier_order_confirmations` service workflow |
| Delivery | `supplierDelivery.ts`, `application/deliveries.ts` | `supplier_deliveries` + line items + inventory events |
| Daily operating plan | `operatingPlan.ts`, `application/operatingPlan.ts` | Projection over Today workflows plus durable restaurant tasks (no independent plan table) |
| Restaurant task | `restaurantTasks.ts`, `application/restaurantTasks.ts` | `restaurant_tasks` + `restaurant_task_dependencies`; create/complete/reopen RPCs |

## Correlation and idempotency

- `sequence_id` groups one operational story in Activity History.
- `recommendation_id`, `action_id`, issue links, order IDs, and evidence arrays preserve why a decision exists.
- Action idempotency uses `send_supplier_order:{orderId}` in hosted and demo modes.
- `client_delivery_id` makes receiving replay-safe.
- Activity events use bounded idempotency keys; outcomes are immutable.
- Restaurant task creation uses a client task id; completion/reopen activity is immutable and dependency release is transactional.

## Truth rules

- Activity is created only from persisted calculations, mutations, provider results, failures, and outcomes.
- Operating-brief status and confidence are deterministic projections of source freshness and completeness.
- `Good` inventory can never carry a today/tomorrow stockout warning.
- A provider rejection is `failed`; an ambiguous provider result is `unverified` and is not retried automatically.
- Explicit operator approval is required before sending a supplier order.
- Delivery receipts atomically update inventory and may produce an outcome and bounded supplier-reliability memory.
- Staffing stays `unknown` without a schedule source.
- Operating-plan windows and reprioritization use only evidenced deadlines (dueAt, delivery dates, urgency, provider errors); supplier cutoff clocks are not invented.
- Owner corrections change the effective memory statement without erasing original evidence.

## Demo/hosted parity

The demo repository mirrors action decisions, send idempotency, delivery replay,
shared-task dependencies and verification, outcomes, activity, memories, and
export datasets locally. Production paths do not import demo demand or silently
fall back to demo rows.

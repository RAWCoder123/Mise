# MISE-005DZ: pin purchase_decision actor_role/decision_type CHECKs to COLLATE C

Date: 2026-10-01
Branch: `cursor/mise-purchase-decision-actor-role-decision-type-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `purchase_decision_events.actor_role` and
`purchase_decision_events.decision_type` allowlists with exact-token contracts
plus ASCII shape under COLLATE `"C"`:

```sql
-- actor_role
actor_role in ('owner', 'admin', 'manager')
and actor_role collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'

-- decision_type
decision_type in (
  'approve',
  'approve_with_override',
  'dismiss',
  'undo',
  'exclude_from_learning'
)
and decision_type collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (MISE-004A purchase decision memory create-table
allowlists and `private.purchase_decision_actor_role` /
`private.record_purchase_decision_*` writers):

- `actor_role`: `owner` / `admin` / `manager`
- `decision_type`: `approve` / `approve_with_override` / `dismiss` / `undo` /
  `exclude_from_learning`

Exact-token allowlists are preserved; this tip adds the COLLATE C ASCII shape
gate alongside them.

## Why

MISE-005A proved locale drift on this cluster. Open tips #451/#482 pin
`source_event_key` / `evidence_version` on the same table but left actor_role
and decision_type on bare IN. Without a dedicated COLLATE C shape CHECK,
dump/restore under LC_CTYPE drift can accept role or decision-type bytes the
restored C-locale path would refuse — or the reverse — breaking
purchase-decision evidence continuity across restore.

## Scope

- CHECK-only on `public.purchase_decision_events.actor_role` and
  `public.purchase_decision_events.decision_type`
- Does **not** rewrite `record_purchase_decision_*` or
  `purchase_decision_actor_role`
- Does **not** touch `purchase_decision_events_shape_check`,
  `source_event_key` (#451), `evidence_version` (#482), `canonical_unit`
  (#490/#491), `recommendation_source`, or finding-decision `decision_type`
  (#537)
- Alone on main OK; timestamp after #537 (`20261001040000`)

## Verification

- `npm run typecheck` — pass
- focused `tests/purchaseDecisionActorRoleDecisionTypeLocalePin.test.ts` — 3/3 pass
- `npm test` — 679 pass / 0 fail / 7 cancelled (inherited cancelledByParent noise; new
  MISE-005DZ cases pass)
- pgTAP fixture committed (plan **24** from 24 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20261001040000_mise_005dz_purchase_decision_actor_role_decision_type_locale_pin.sql`
- `supabase/tests/database/purchase_decision_actor_role_decision_type_locale_pin.test.sql`
- `tests/purchaseDecisionActorRoleDecisionTypeLocalePin.test.ts`
- `docs/automation-reports/2026-10-01-purchase-decision-actor-role-decision-type-locale-pin.md`

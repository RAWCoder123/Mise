# MISE-005XF Autonomy rule supplierName ASCII C (2026-11-03)

## Defect

Autonomy Supplier scope used `rule.supplierName ?? "—"`. Empty /
Unicode-only-space names are non-nullish under `??`, so they bypassed the
intentional none marker and rendered blank-looking supplier identity.
Unicode `.trim()` on padded names would invent a clean supplier label.

## Fix

- `presentationAutonomyRuleSupplierNameIdentity.ts` — ASCII C
  single-line prep (end trim only; preserve NBSP; full C0/DEL reject)
- Soft-null via `normalizeAutonomyRuleSupplierName` before Supplier scope
  ReadOnlyField render
- Localized fallback `autonomy.field.supplier.none` (EN/ES/zh-Hans; keeps
  the intentional typographic dash none marker)

## Alone-OK

Leaves Autonomy subtitle restaurant.name (#1043), Settings suppliers
entry.supplierName (#1054), daily-report supplier.supplierName (#1053),
Inventory detail supplier_name (#1052), Orders review supplier_name (#1051),
SupplierDraftCard order.supplier_name (#1050), Orders detail title
supplier_name (#1016), restaurant_autonomy_rules supplier_name cntrl CHECK
(#613), and React list keys alone.

## Verification

- focused `tests/autonomyRuleSupplierNameAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`

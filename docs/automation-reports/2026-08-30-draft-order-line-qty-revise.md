# Draft order line quantity revise (2026-08-30)

## Change
Managers can revise approved draft supplier-order line quantities from order
detail by composing existing undo + re-approve authority RPCs. No migration.

## Depends on
PR #284 (`cursor/mise-draft-order-line-undo`) linked-line undo surface.

## Verified
- Domain guards for revise eligibility / unchanged quantity
- Demo application revise updates approved quantity and no-ops when unchanged
- Order detail wires revise UI + i18n (EN/ES/zh-Hans)

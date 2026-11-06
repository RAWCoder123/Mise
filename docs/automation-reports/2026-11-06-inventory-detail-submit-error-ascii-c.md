# Inventory detail submitError.message ASCII C (MISE-005YG)

Date: 2026-11-06
Branch: `cursor/mise-inventory-detail-submit-error-ascii-c`
Base: `origin/main` @ `78da7376`

## Problem

Inventory detail submit catch selected its operator notice with:

```ts
setMessage(
  submitError instanceof Error && submitError.message.trim()
    ? submitError.message.slice(0, 220)
    : t("inventory.ops.submitError")
);
```

Unicode `.trim()` on em-space-padded `Error.message` invents clean gate
presence and forces the raw untrimmed slice branch. Soft empty /
Unicode-only-space / unsafe diagnostics must fall through to the localized
`inventory.ops.submitError` copy without inventing.

## Changes

- Add `services/domain/inventoryDetailSubmitErrorMessageIdentity.ts`
  (multiline operator_note-style ASCII C prep; soft-null on empty /
  Unicode-padded / unsafe controls; max 220 after prep)
- Route Inventory detail submit catch through
  `describeInventoryDetailSubmitError(..., t("inventory.ops.submitError"))`
- Leave Log Delivery's twin `submitError.message.trim()` path, inventory
  detail settings/add localized catches, and `message ?? notFound` alone

## Inventing / bypass proof

- `"\u2003Queue flush failed while recording the count.\u2003".trim() === "Queue flush failed while recording the count."` inventing equality for the presence gate
- Prior path then displayed the raw padded `.slice(0, 220)` rather than a proven clean diagnostic
- ASCII C soft-null restores the localized `inventory.ops.submitError` fallthrough

Distinct from Log Delivery submitError (same prior pattern, separate tip) and
from recalculation / account-deletion / Gmail / Square error-haystack tips.

## Alone-OK

No migration. Alone-OK on main beside #1138 / #1137 / #1100–#1133 / #928–#933;
ordinary conflicts possible only if another tip rewrites the same Inventory
detail catch.

## Verification

- Focused `tests/inventoryDetailSubmitErrorMessageAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm run design:static`
- `npm test`

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.

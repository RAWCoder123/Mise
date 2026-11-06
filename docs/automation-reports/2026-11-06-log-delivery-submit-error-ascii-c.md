# Log Delivery submitError.message ASCII C (MISE-005YH)

Date: 2026-11-06
Branch: `cursor/mise-log-delivery-submit-error-ascii-c`
Base: `origin/main` @ `78da7376`

## Problem

Log Delivery submit catch selected its operator notice with:

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

- Add `services/domain/logDeliverySubmitErrorMessageIdentity.ts`
  (multiline operator_note-style ASCII C prep; soft-null on empty /
  Unicode-padded / unsafe controls; max 220 after prep)
- Route Log Delivery submit catch through
  `describeLogDeliverySubmitError(..., t("inventory.ops.submitError"))`
- Leave Inventory detail's twin `submitError.message.trim()` path (#1139 /
  MISE-005YG), Log Delivery itemName/note/quantity tips, and
  `message ?? notFound` alone

## Inventing / bypass proof

- `"\u2003Queue flush failed while recording the receipt.\u2003".trim() === "Queue flush failed while recording the receipt."` inventing equality for the presence gate
- Prior path then displayed the raw padded `.slice(0, 220)` rather than a proven clean diagnostic
- ASCII C soft-null restores the localized `inventory.ops.submitError` fallthrough

Distinct from Inventory detail submitError (#1139) and from recalculation /
account-deletion / Gmail / Square error-haystack tips.

## Alone-OK

No migration. Alone-OK on main beside #1139 / #1138 / #1100–#1137 / #928–#933;
ordinary conflicts possible only if another tip rewrites the same Log Delivery
catch.

## Verification

- Focused `tests/logDeliverySubmitErrorMessageAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm run design:static`
- `npm test`

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.

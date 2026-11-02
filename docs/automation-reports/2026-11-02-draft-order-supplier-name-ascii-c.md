# MISE-005VZ — pin miseDomain draft-order supplier_name to ASCII C

Date: 2026-11-02

## Defect

`buildDraftsFromRecommendations` selected draft `supplier_name` / order-message
greeting with:

```ts
const supplierName = items[0]?.supplier_name ?? "Supplier";
```

Unicode-only-space (`"\u2003"`) and empty string are non-nullish under `??`, so
the intentional hard-coded `"Supplier"` empty-state was bypassed and padding
could be written into durable draft orders and supplier order messages.
Unicode `.trim()` on padded supplier names would invent a clean display
identity (`"\u2003Harbor Produce\u2003".trim() === "Harbor Produce"`).

## Fix

- Add `services/domain/presentationDraftOrderSupplierNameIdentity.ts`
  (ASCII C end trim only; preserve NBSP; full C0/DEL reject; soft-null on
  empty / Unicode-padded / controls).
- Route `buildDraftsFromRecommendations` through
  `normalizeDraftOrderSupplierName(...) ?? "Supplier"`.

## Alone-OK

Does **not** own Orders detail title supplier_name (#1016), orderAutomation
supplierName (#833), supplierReliability supplierName (#834), demo supplier
display-name (#914), Settings suppliers recipient-email (#1032), supplier
operator_note (#840), or SQL supplier_name cntrl pins (#612 / #610 / #589).

## Verification

- Focused `tests/draftOrderSupplierNameAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm test`

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.

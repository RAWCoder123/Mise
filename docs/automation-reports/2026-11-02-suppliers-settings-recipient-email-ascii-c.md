# MISE-005VX Settings suppliers recipient-email ASCII C (2026-11-02)

## Defect

Settings suppliers directory used stored `entry.email` as a truthy /
non-nullish gate before intentional missing-email presentation:

```ts
Boolean(entry.email)
entry.email ? copy.configured : copy.needsEmail
entry.email ?? copy.notConfigured
```

Unicode-only-space and empty string are truthy / non-nullish under those
rows, so a padded recipient could count as Ready and bypass localized
`copy.notConfigured`. Unicode `.trim()` on padded mailboxes would invent
clean display recipient identity.

## Fix

- `services/domain/presentationSuppliersSettingsRecipientEmailIdentity.ts`
- Soft-null via `normalizeSuppliersSettingsRecipientEmail` (ASCII C
  single-line: ASCII end trim only; preserve NBSP — no fold; full C0/DEL
  reject) before configured-count, Ready/needsEmail badge + icon tone,
  read-only display `|| copy.notConfigured`, and read-only a11y on
  `app/settings/suppliers.tsx`

## Ownership

Owns only Settings suppliers **stored** recipient-email presentation
(configured count / Ready badge / read-only notConfigured + a11y). Does
**not** own draft-email save/equality (#690), suppliers display-name
(#691), Settings/Gmail sender_email (#1019), Orders gmail sender (#1020),
setup-readiness Gmail ready (#1031), Settings account email (#966), Orders
detail email-review headers (#1015), or durable recipient writers
(#681 / #423). Alone-OK relative to #690/#691/#1031/#1020/#1019/#966/#1015.

## Inventing / bypass proof

- `Boolean("\u2003") === true` marks Ready incorrectly
- `("\u2003" ?? FALLBACK) === "\u2003"` bypasses `copy.notConfigured`
- `("" ?? FALLBACK) === ""` same bypass
- `"\u2003orders@farm.co\u2003".trim() === "orders@farm.co"` inventing equality
- ASCII C soft-null restores needsEmail / notConfigured presentation

## Verification

- Focused `tests/suppliersSettingsRecipientEmailAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm test` (expect inherited recalculationCycles cancellations only)

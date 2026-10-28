# MISE-005SN: pin supplier-send preview expected identities to ASCII C

Date: 2026-10-28  
Branch: `cursor/mise-supplier-send-preview-expected-ascii-c`  
Base: `origin/main` @ `78da737`

## Change

Pins `requireExactSupplierSendId`'s expected restaurant/order tokens to ASCII-only
end trim so Unicode `.trim()` cannot invent a successful preview scope match
against a clean payload identity via NBSP/em-space padding.

- Adds `services/domain/supplierSendPreviewExpectedIdentity.ts` with fail-closed
  canonicalize/require helpers.
- Routes `requireExactSupplierSendId` expected tokens through
  `requireCanonicalSupplierSendPreviewExpectedId`.
- Preserves
  `Supplier send preview returned an invalid ${label} identity.`
- Leaves payload `value` exact-match + control gating alone.
- Leaves supplier-send text/email/body/fingerprint parsers and demo
  subject/mailbox tips (#913 / #708) alone.

## Inventing proof

Prior path Unicode-trimmed the expected restaurant/order id before comparing it
to the clean payload id:

```text
'\u2003' + restaurantId + '\u2003'
  .trim()
  === restaurantId
```

That invented a successful scope match. ASCII C prep leaves em-space / NBSP
alone and fails closed (`trimmed !== trimmed.trim()`).

## Verification

- focused `tests/supplierSendPreviewExpectedAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`
- Docker pgTAP unavailable in this environment

## Do not

- Re-tip this expected-identity path after merge.
- Bundle demo subject (#913), mailbox (#708), or Mise-actions object (#761)
  tips in the same PR.
- Rewrite payload `value` matching or supplier-send free-text parsers here.

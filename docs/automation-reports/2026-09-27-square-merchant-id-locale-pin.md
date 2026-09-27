# MISE-005AZ: Square merchant_id COLLATE C locale pin

Date: 2026-09-27
Branch: `cursor/mise-square-merchant-id-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the length-only CHECK on `private.square_credentials.merchant_id` with
an ASCII shape under COLLATE `"C"`:

```text
merchant_id collate "C" ~ '^[A-Za-z0-9_-]{1,128}$'
```

Rewrite the matching writer gates in:

- `private.service_complete_square_oauth`
- `private.service_resolve_square_webhook_merchant`

Preserve `service_role` EXECUTE. Leave public wrappers untouched.

Add Edge allowlists:

- `isSquareMerchantId` / `SQUARE_MERCHANT_ID_PATTERN` in `_shared/square.ts`
  (token parse fail-closed)
- `square-webhooks` ignores non-ASCII merchant ids before the resolve RPC

## Why

`merchant_id` is the durable global Square merchant identity used for webhook
resolution and credential binding. Length-only storage plus Unicode-tolerant
`stringField` could accept identities that a restored C-locale path would
refuse (or the reverse), breaking reconnect continuity after dump/restore.

## Out of scope

- begin/claim OAuth state_hash / PKCE (#438)
- gmail_safe_error_code / provider failure codes (#439/#450)
- activity_events / restaurant_memories / inventory_events (#375)
- supplier confirmation / delivery identity (#458/#459)

## Verification

- `npm run typecheck`
- focused: `squareMerchantIdLocalePin`
- `npm test`
- `npm run supabase:test` blocked locally when Docker unavailable

# Fail-closed supplier receive for unverified canonical units

Date: 2026-08-26  
Branch: `cursor/mise-receive-unverified-fail-closed`  
Base: `origin/main` @ `20b28e5`

## Problem

`receiveSupplierOrderDelivery` built verified-only lines, then silently fell back to
unverified units when none qualified. Mixed verified/unverified orders could also
succeed for the verified subset while `skippedItemIds` were dropped. Both paths
understate on-hand inventory after a “successful” receive.

## Change

- Domain: `assertReceivableDeliveryLines` + `SupplierDeliveryLinesSkippedError`
  fail closed whenever any ordered line is skipped.
- Application: always `requireVerifiedCanonicalUnit: true`; removed the unverified
  fallback; never records a partial silent receive.
- Order detail: maps the structured error to EN/ES/zh-Hans copy with recovery to
  `/inventory` so operators can verify units.
- Tests pin mixed, all-unverified, all-verified, source regression, and UI wiring.

## Complementary to #182

#182 adds received/damaged/missing discrepancy checklist UI. This PR closes the
unverified-unit silent-skip / fallback hole. Prefer landing this beside or after
#182 with a rebase if both touch `deliveries.ts` / `orders/[id].tsx`.

## Verification

- `npm run typecheck` passed
- `node --import tsx --test tests/supplierDeliveryUnverifiedReceive.test.ts` — 6/6
- `npm test` — 638 pass / 0 fail (7 pre-existing cancellations)

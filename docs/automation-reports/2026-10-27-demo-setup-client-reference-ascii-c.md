# MISE-005SD: pin demo setup client-reference identity to ASCII C

Date: 2026-10-27

## Summary

Stop Unicode `.trim()` on demo `saveRestaurantSetupSnapshot` supplier
`client_reference_id` and inventory `supplier_client_reference_id` from
inventing clean durable setup Map keys via NBSP or em-space padding
(`'\u2003supplier-1\u2003'.trim() === 'supplier-1'`).

## Inventing proof

Prior demo repository setup Unicode-trimmed both client-reference fields
before using them as Map keys that bind inventory drafts to supplier drafts.
Em-space / NBSP end padding invented a clean reference; ASCII C fails closed.
Soft empty (including Unicode-only space) still rejects under the prior empty
contracts.

## Change

- New `services/domain/demoSetupClientReferenceIdentity.ts` (MISE-005SD)
- Soft empty / Unicode-only space → throw prior empty-reject messages
- ASCII whitespace still trims clean before durable Map keys
- Unicode end padding and controls → throw
- Wire demoRepository supplier + inventory setup reference paths
- Leave application setup reference tip #769 / MISE-005MM alone

## Verification

- focused AsciiC 4/4
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test` (report totals in PR)

## Merge note

Alone-OK with #769/#683/#914/#915. Keep `demoSetupClientReferenceIdentity.ts`
separate from `setupReferenceIdentity.ts` (#769). When landing with #683 on
the same `demoRepository.ts` file, resolve textually; do not consolidate onto
that inventory/menu name-key module.

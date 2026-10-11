# MISE-005NQ: finding-decision response actor_user_id ASCII C

## Inventing proof

`normalizeOperationalFindingDecision` used Unicode `requireBoundedText` on
response `actor_user_id` ("Finding decision actor", max 64). NBSP/em-space
padding invented a valid actor identity used as durable feedback attribution
authority.

```text
'\u00a0aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\u00a0'.trim() === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
```

ASCII-C canonicalize returns `null` for the same padded token. Null actors
remain allowed.

## Change

- Added `services/domain/operationalFindingDecisionResponseActorIdentity.ts`
- Routed response `actor_user_id` through ASCII-C require helper
- Preserved `Finding decision actor is invalid.`; length capped at 64
- Left response decision `id` (#796), `client_event_id` (#797),
  `idempotency_key` (#798), `finding_id` (#795), enums (#794), evidence type/id,
  restaurant, input object identities (#790), input `idempotencyKey`, and
  outbox tips alone

## Merge notes

Alone-OK. When landing with #796 drop the cross-assertion that response
decision `id` still Unicode-trims via `requireBoundedText`. When landing with
#797 drop the cross-assertion that response `client_event_id` still
Unicode-trims. When landing with #798 drop the cross-assertion that response
`idempotency_key` still Unicode-trims. Keep separate from #790 input object
identities; do not merge error contracts.

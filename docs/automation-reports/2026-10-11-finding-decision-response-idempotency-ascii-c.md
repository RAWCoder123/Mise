# MISE-005NP: finding-decision response idempotency_key ASCII C

## Inventing proof

`normalizeOperationalFindingDecision` used Unicode `requireBoundedText` on
response `idempotency_key` ("Finding decision idempotency key", max 240).
NBSP/em-space padding invented a valid idempotency identity used as durable
feedback dedupe authority.

```text
'\u00a0finding-decision:device-event-1\u00a0'.trim() === 'finding-decision:device-event-1'
```

ASCII-C canonicalize returns `null` for the same padded token.

## Change

- Added `services/domain/operationalFindingDecisionResponseIdempotencyIdentity.ts`
- Routed response `idempotency_key` through ASCII-C require helper
- Preserved `Finding decision idempotency key is invalid.`; length capped at 240
- Left response decision `id` (#796), `client_event_id` (#797), `finding_id`
  (#795), enums (#794), evidence type/id, restaurant, input object identities
  (#790), input `idempotencyKey`, response `actor_user_id`, and outbox tips alone

## Merge notes

Alone-OK. When landing with #796 drop the cross-assertion that response
decision `id` still Unicode-trims via `requireBoundedText`. When landing with
#797 drop the cross-assertion that response `client_event_id` still
Unicode-trims via `requireBoundedText`. Keep separate from #790 input object
identities; do not merge error contracts.

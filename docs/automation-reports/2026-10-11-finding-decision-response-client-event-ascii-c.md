# MISE-005NO: finding-decision response client_event_id ASCII C

## Inventing proof

`normalizeOperationalFindingDecision` used Unicode `requireBoundedText` on
response `client_event_id` ("Finding decision event identity", max 200).
NBSP/em-space padding invented a valid client-event identity used as durable
feedback correlation.

```text
'\u00a0device-event-1\u00a0'.trim() === 'device-event-1'
```

ASCII-C canonicalize returns `null` for the same padded token.

## Change

- Added `services/domain/operationalFindingDecisionResponseClientEventIdentity.ts`
- Routed response `client_event_id` through ASCII-C require helper
- Preserved `Finding decision event identity is invalid.`; length capped at 200
- Left response decision `id` (#796), `finding_id` (#795), enums (#794),
  evidence type/id, restaurant, input object identities (#790), response
  `idempotency_key` / `actor_user_id`, and outbox tips alone

## Merge notes

Alone-OK. When landing with #796 drop the cross-assertion that response
decision `id` still Unicode-trims via `requireBoundedText`. When landing with
#790 keep input and response client-event modules separate; do not merge error
contracts.

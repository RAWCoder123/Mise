# MISE-005QH activity-event idempotency key ASCII C

Date: 2026-10-25  
Branch: `cursor/mise-activity-idempotency-key-ascii-c`

## Inventing proof

`activityIdempotencyKey` previously Unicode-trimmed
`event.metadata.idempotencyKey` and returned the trimmed token as the durable
dedupe / persist identity:

```text
'\u2003recommendation_created:rec-1\u2003'.trim() === 'recommendation_created:rec-1'
```

That invents parallel activity identities before `dedupeActivityEvents` and
`toActivityEventRow` persist.

Open #790 / MISE-005NH owns finding-decision `clientEventId` /
`idempotencyKey` normalize only. Open #569 owns the SQL `idempotency_key`
cntrl CHECK. Open #772 owns mise-actions domain object identities. None of
those own this activity-event metadata read path.

## Change

- `services/domain/activityEventIdempotencyIdentity.ts` — ASCII-only end trim
  + fail-closed canonicalize (max 240); soft normalize for fallthrough
- Wired `activityIdempotencyKey` through `normalizeActivityEventIdempotencyKey`
- Soft empty / Unicode-padded / control / over-long → synthetic key fallthrough
  (prior helper never threw on a bad explicit key)

## Alone-OK merge notes

Alone-OK with #790 / #569 / #772. Keep
`activityEventIdempotencyIdentity.ts` separate. Leave
`requireRestaurantId` Unicode trim on its existing contract.

## Verification

- focused `tests/activityEventIdempotencyAsciiC.test.ts` — 4/4
- `npm run typecheck` — pass
- `npm run security:static` / `npm run security:backend` — pass
- `npm test` — 687 total / 680 pass / 0 fail / 7 cancelled (pre-existing
  `recalculationCycles` `withTimeout` hung-promise `cancelledByParent` on this
  runner; not introduced by this tip)
- Docker pgTAP unavailable in this environment

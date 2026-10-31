# MISE-005VA restaurant-tasks hosted restaurant ASCII C (2026-10-31)

## Summary

Stop Unicode `.trim()` on hosted `createRestaurantTask` / `completeRestaurantTask` `input.restaurantId` from inventing a clean restaurant workspace identity via NBSP/em-space padding before dependency loads and tenant-scope validation.

## Inventing proof

Prior hosted path:

```text
'\u2003restaurant_a\u2003'.trim() === 'restaurant_a'
```

That invented workspace id was then used to load task dependencies and compare against the persisted task row inside supabaseRepository create/complete. Soft empty / Unicode-only space also collapsed through `.trim()` into a mismatch against a real persisted id, or into an invented clean match when the row already held the unpadded tenant id.

Open application tip #739 / MISE-005LI already pins `listSharedRestaurantTasks` / reopen workspace prep and left these hosted create/complete `.trim()` call sites alone.

## Change

- Add `services/repositories/restaurantTasksHostedRestaurantIdentity.ts` (ASCII end trim; fail closed on Unicode padding / controls / over-long / non-string)
- Route hosted `createRestaurantTask` / `completeRestaurantTask` through `requireCanonicalRestaurantTasksHostedRestaurantId`
- Preserve `Restaurant task failed restaurant scope validation.`
- Leave application `#739` `restaurantTasksRestaurantIdentity.ts` alone
- Leave `reopenRestaurantTask` (already untrimmed) and `recordRecalculationRun` `input.restaurantId.trim()` alone for a separate tip

## Verification

- Focused AsciiC
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`

## Merge note

Alone-OK relative to #739. Keep `restaurantTasksHostedRestaurantIdentity.ts` separate from application `restaurantTasksRestaurantIdentity.ts`. When landing with #739, keep both restaurant branches; drop any assertion that hosted create/complete still Unicode-trims `input.restaurantId`.

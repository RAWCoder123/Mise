# Purchase-Recommendation Tenant-Denial Revalidation Design

## Goal

When a hosted purchase-recommendation read or decision fails because the
operator no longer has tenant authority, notify the live session revalidation
listener with the exact restaurant ID and preserve the exact repository error.

## Scope

Cover the repository paths that make up the purchase-recommendation decision
workflow:

- find an existing pending recommendation;
- create or update a recommendation;
- approve, dismiss, or undo a recommendation decision; and
- exclude purchase-decision evidence from learning.

Keep repository contracts, application orchestration, database RPCs, demo mode,
and Orders UI behavior unchanged.

## Approaches Considered

1. **Use the existing repository error boundary (selected).** Replace each plain
   repository rethrow with `throwRepositoryError(error, restaurantId)`. This is
   the narrowest change, preserves error identity, and reuses the classifier and
   listener isolation already covered by the branch.
2. Catch errors in application services. This would duplicate infrastructure
   behavior above the data boundary and miss direct repository consumers.
3. Wrap the Supabase client globally. This is broader than the workflow,
   obscures operation context, and risks duplicate notifications on paths that
   already use the shared boundary.

## Data and Error Flow

The Supabase query or RPC returns an error. The repository passes the original
error and exact restaurant ID to `throwRepositoryError`. Authorization failures
notify every tenant-denial subscriber once; all errors are then rethrown without
wrapping or replacement. Non-authorization failures remain ordinary repository
errors and do not trigger membership revalidation.

## Testing

Extend the existing runtime repository harness with each of the seven workflow
paths. The harness must prove that every authorization failure:

- rejects with the same error object;
- adds exactly one notification; and
- carries the exact restaurant ID.

Add a representative non-authorization mutation failure to prove the new
boundary does not revalidate membership for a transient backend error. Run the
focused tenant-safety tests, typecheck, full unit suite, backend and static
security checks, and `git diff --check`.

## Non-Goals

- No permission or RLS policy changes.
- No recommendation quantity, authority, or learning-policy changes.
- No session-context or UI changes.
- No purchase-line ledger changes.

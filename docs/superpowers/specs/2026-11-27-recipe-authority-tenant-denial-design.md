# Recipe-Authority Tenant-Denial Revalidation Design

## Goal

When a hosted recipe-authority read or confirmation fails because the operator
no longer has tenant authority, notify the live session revalidation listener
with the exact restaurant ID and preserve the exact repository error.

## Scope

Cover the two live repository RPC paths that read or confirm recipe authority:

- list recipe-authority states for a restaurant; and
- confirm one menu item's recipe revision as complete.

Keep recipe calculations, recipe revisions, confirmation rules, repository
contracts, application orchestration, database RPCs, demo mode, and Inventory
UI behavior unchanged.

The direct `menu_item_ingredients` update and upsert methods are outside this
slice. They are unused by live product flows and are already owned by open draft
PR #403, which removes those methods. The live recipe-mapping write uses
`invokeOperationalWorkflow`, whose shared repository boundary already performs
tenant-denial notification.

## Approaches Considered

1. **Use the existing repository error boundary (selected).** Replace each
   recipe-authority RPC's plain rethrow with
   `throwRepositoryError(error, restaurantId)`. This is the narrowest change,
   preserves error identity, and follows the repository's established
   restaurant-scoped behavior.
2. Catch errors in the Inventory application service. This would duplicate
   data-boundary behavior, miss direct repository consumers, and complicate the
   parallel recipe-summary read.
3. Wrap every Supabase RPC globally. This would be broader than the two known
   gaps and could duplicate notifications on paths that already use the shared
   boundary.

## Data and Error Flow

The Supabase RPC returns an error. The repository passes that same error and the
exact restaurant ID to `throwRepositoryError`. Authorization failures notify
every tenant-denial subscriber once; the same error object is then rethrown.
Non-authorization failures are rethrown unchanged without membership
revalidation.

Successful responses keep their existing validation. Listing still requires an
array of recipe-authority records, and confirmation still parses one authority
record through `parseRecipeAuthorityState`.

## Testing

Extend the runtime repository harness with both recipe-authority paths. For each
authorization failure, prove that the operation:

- rejects with the same error object;
- emits exactly one notification; and
- carries the exact restaurant ID.

Add a representative non-authorization recipe-authority failure to prove that
the boundary does not revalidate membership for a transient backend error.
Derive the direct-path notification expectation from the operation list's
assertion call sites, then run the focused tenant-safety tests, typecheck, full
unit suite, backend and static security checks, and `git diff --check`.

## Non-Goals

- No recipe-authority, revision, permission, or RLS policy changes.
- No recipe-mapping write-path changes.
- No direct PostgREST mutator changes owned by PR #403.
- No session-context, database, demo, or UI changes.

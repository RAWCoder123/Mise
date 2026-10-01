# Sales import restaurant-switch isolation (2026-08-25)

## Verdict

Sales CSV import no longer carries draft text, validation errors, or success
banners across restaurant switches, and late import completions cannot update
another restaurant's UI.

## Problem

`app/settings/sales-import.tsx` kept `csvText`, `error`, and `successRows` in
component state with no `restaurant?.id` reset. A manager who pasted sales for
Restaurant A, then switched to Restaurant B, still saw A's draft and could
mistake it for B's data. An in-flight `saveRestaurantSetup` for A could also
clear B's draft or show A's success after the switch.

## Change

- Clear CSV draft, error, success, and saving lock when `restaurant?.id` changes.
- Bump an import request generation on switch so in-flight completions are ignored.
- After `saveRestaurantSetup`, apply success/error/`setCsvText` only when the
  request generation and active restaurant still match the save target.
- Only the latest request clears the submit lock and saving flag.

## Paths

- `app/settings/sales-import.tsx`
- `tests/clientTenantSafety.test.ts`
- `docs/automation-reports/2026-08-25-sales-import-restaurant-switch.md`

## Verification

- `npm run typecheck`
- `node --test --import tsx tests/clientTenantSafety.test.ts`

## Not claimed

- Server-side readiness revalidation inside purchase approval (Codex/migrations).
- Sync→planning correlation owned by open PRs #130/#132.
- Hosted tenant proof or physical-device TestFlight verification.

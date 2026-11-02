# MISE-005VY: pin miseDomain demo/setup readiness cuisine_type to ASCII C

Date: 2026-11-02  
Branch: `cursor/mise-demo-readiness-cuisine-ascii-c`

## Defect

`buildDemoReadinessSummary` decided profile ready/attention with
`restaurant.cuisine_type?.trim()` and selected evidence with
`restaurant.cuisine_type ?? "Cuisine not set"`.
`buildSetupReadinessSummary` used the same Unicode-trim emptiness gate for
`"cuisine/service style"`.

- Unicode-only-space cuisine is non-nullish, so `"Cuisine not set"` was bypassed.
- Unicode `.trim()` on padded cuisine invented a clean label and could mark
  profile ready / omit the setup missing entry.

## Fix

- Add `services/domain/presentationDemoReadinessCuisineIdentity.ts`
  (ASCII C single-line prep; soft-null on empty / Unicode-padded / controls;
  preserve NBSP; no case fold).
- Route demo profile status/evidence and setup profile missing cuisine through
  `normalizeDemoReadinessCuisine`.

## Alone-OK

Does **not** own Insights subtitle cuisine (#1029), Settings workspace cuisine
meta (#1023), Insights ProfileChip (#970), branding initials/English cuisine
(#967), durable `requireRestaurantCuisineType` (#842), or restaurants.cuisine
CHECK pins (#549). Leaves restaurant-name inventing alone.

## Verification

- Focused `tests/demoReadinessCuisineAsciiC.test.ts` (7/7)
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm test`: 690 total / 683 pass / 0 fail / 7 cancelled (inherited
  recalculationCycles `withTimeout` cancellations)

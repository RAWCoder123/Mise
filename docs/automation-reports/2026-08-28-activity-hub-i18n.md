# Activity hub category / status / trigger i18n

Date: 2026-08-28  
Branch: `cursor/mise-activity-hub-i18n`  
Base: `origin/main` @ `20b28e5`

## Problem

`app/more/activity.tsx` rendered raw English enums for category, status,
trigger type, related entity type, and evidence type on the Activity hub,
including for ES and zh-Hans operators (`inventory · waiting for approval`,
snake_case triggers).

## Change

- Add `services/presentation/activityEventLabels.ts` with exhaustive category,
  status, and related-entity message keys plus a known-trigger map.
- Unknown free-form tokens humanize (`snake_case` → spaces) instead of crashing.
- Wire the Activity hub through those helpers and drop forced `capitalize` so
  localized labels are not mangled.
- Catalog entries for EN / ES / zh-Hans covering categories, statuses, related
  entities, and known triggers (including activity-type mirrors).

## Verification

- `npm run typecheck`
- `npm test` (635 pass / 0 fail / 7 cancelled timeout harness)
- New coverage: `tests/activityEventLabels.test.ts`

## Out of scope

- Localizing free-form event `title` / `summary` / evidence summary strings
  (those are stored operational copy, not enum tokens).
- Invite-gated Auth signup for first-time invitees (follow-up to open #235).
- Landing open PR stacks onto main.

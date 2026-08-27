# Home POS sync failure outlook (2026-08-27)

## Problem

Today already opens an urgent repair task when `pos_integrations.status === "error"`, but Home’s operating brief never loaded POS integrations. Pulse could stay `on_track` while Square (or another provider) was broken, and the status card never routed to `/settings/pos`.

## Change

- `fetchOperatingBrief` loads restaurant-scoped POS integrations.
- Domain classifies evidenced connection health (`ok` / `error` / `none` / `unknown`).
- `status === "error"` escalates pulse to `at_risk`, adds a monitoring row, and names the provider failure in outlook detail without inventing sale counts.
- Home shows a localized POS-failure banner (EN / ES / zh-Hans) that routes to `/settings/pos`.
- Morning and Pre-Service phase briefs surface an urgent finding with the same evidence.

## Verification

- `npm run typecheck`
- `npm test` (operating brief + daily phase brief coverage)

## Out of scope

- Does not depend on `#185` planning-sync columns.
- Does not duplicate overdue delivery Home work (`#205`).
- Does not invent inventory or sales quantities.

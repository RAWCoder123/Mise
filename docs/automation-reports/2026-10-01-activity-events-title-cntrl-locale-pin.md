# MISE-005EV activity_events.title cntrl locale pin

## Summary

CHECK-only locale pin for append-only activity feed titles:

- Reattach `activity_events_title_check` — keep `length(trim(title)) between 1 and 160`, add ASCII control rejection under COLLATE `"C"`:
  `title collate "C" !~ '[[:cntrl:]]'`
- Single-line activity title field; full C0 + DEL rejection (same class as restaurant_tasks.title / restaurants.name).
- Domain `requiredActivityTitle` rejects the same ASCII C control set on build/read normalize paths.

Does not rewrite activity RPCs or sibling tips (#559/#558/#557/#556/#555/#554).

## Verification

- `npm run typecheck` — passed
- focused `activityEventsTitleCntrlLocalePin` — 4/4
- `npm test` — 680 pass / 0 fail / 7 cancelled
- pgTAP plan **12** counted from 12 assertion call sites (Docker unavailable in this environment)

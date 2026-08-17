# Home consumes pilot readiness (2026-08-17)

## Completed

- Home loads `fetchPilotReadiness` in parallel with the operating brief and today summary.
- Fail-closed: readiness load failure or missing payload blocks one-tap recommendation approve.
- Material blockers surface on Home (recommend vs send vs unavailable) with EN/ES/zh-Hans copy.
- Recommendation cards show “Review setup” and route to `/settings/pos` when `canRecommend` is false.
- Supplier-send review cards still open the exact draft; they are not auto-executed from Home.

## Files

- `app/(tabs)/home.tsx`
- `services/presentation/homePilotReadinessPresentation.ts`
- `i18n/catalog.ts`
- `tests/homePilotReadinessPresentation.test.ts`
- `tests/pilotUiSafety.test.ts`

## Verification

- `npm run typecheck` — pass
- `node --import tsx --test tests/homePilotReadinessPresentation.test.ts tests/pilotUiSafety.test.ts` — 12 pass / 0 fail
- `npm test` — 509 pass / 0 fail (7 pre-existing timeout cancels)

## Not claimed

- Server-side approval readiness enforcement (open PR #130).
- Count-time depletion anchoring (open PR #131).
- POS planning sync stale state (open PR #132).

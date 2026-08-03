# Today hub soft-refresh and false-clear polish

Date: 2026-08-03
Branch: `cursor/mise-product-inspection-88a9`
Base tip: `origin/cursor/mise-product-inspection-0840`

## Gap

`/today` already soft-refreshed the command-center summary and showed `RetryNotice`, but it had no hub load-state presenter. After an initial fetch failure, the screen fell back to a blank stack under the retry banner. Soft-refresh failures were safer (last-known summary stayed visible), yet loading/error section shells were still missing for:

- Service pulse (“Service is on track” false-clear risk if blank data were shown)
- Inventory health
- Tasks (“No operational work is waiting” false-clear)
- Sales movement (“No recorded sales” false-empty)

## Fix

- Added `services/presentation/todayHubPresentation.ts` with:
  - `resolveTodayHubLoadState`
  - `presentTodayServicePulseCopy`
  - `presentTodayInventoryHealthCopy`
  - `presentTodayTasksEmptyCopy`
  - `presentTodaySalesEmptyCopy`
- Today hub now resolves `hubLoadState` / `hubReady`, gates the summary behind `hubReady`, and always renders section shells with loading/unavailable copy when the active restaurant has not finished loading.
- Soft refresh after a successful load still keeps last-known data while surfacing `RetryNotice`.
- Retry uses `load(true)` and localized `common.retry`.
- EN / ES / zh-Hans catalog keys for service pulse, inventory health, tasks, and sales loading/unavailable copy.
- Tests: `tests/todayHubPresentation.test.ts`; tenant-safety and localization wiring updated.

## Verification

- `npm run typecheck` — passed
- `npm test` — 443/443 passed
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- `npm run qa:routes` — passed (includes `/today`)
- Docker `supabase:test` still unavailable in this environment

## Product state

- Classification remains **controlled pilot-ready** (not App Store submission-ready).
- Next implementable UX candidate: setup/create-item localization/status polish.
- Still blocked: Docker/hosted private-beta security re-proof; founder Auth redirect / privacy URLs; Apple/EAS/device QA; live POS/Gmail credentials.

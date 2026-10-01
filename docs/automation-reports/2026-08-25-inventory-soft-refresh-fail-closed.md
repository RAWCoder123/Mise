# Inventory soft-refresh fail-closed (2026-08-25)

Branch: `cursor/mise-inventory-soft-refresh-fail-closed`  
Base: `origin/main` @ `6eedbfb`

## Gap

Inventory already gated outlook rows and count actions through
`resolveRestaurantScopedHubLoadState`, so soft-refresh failures hid stock cards
and health totals. The expanded stock browser still claimed
`inventory.emptyMatches` whenever the cleared outlook list was empty, including
after a load error while search/filter drafts remained open. That presented a
blank filtered list as “no matching stock” next to RetryNotice.

## Fix

- Treat `hubLoadState === "error"` as `hubUnavailable`.
- Show dedicated unavailable copy for the stock-browser empty state on soft-refresh failure.
- Keep true “no matches” copy only when the hub is ready.
- Preserve search query and stock filter drafts across soft-refresh (unchanged); restaurant switch still clears them.

## Paths

- `app/(tabs)/inventory.tsx`
- `i18n/catalog.ts` (EN / ES / zh-Hans)
- `tests/clientTenantSafety.test.ts`
- `docs/automation-reports/2026-08-25-inventory-soft-refresh-fail-closed.md`

## Out of scope

- Home / Activity / secondary-hub soft-refresh PRs (#150–#152, #163–#167)
- Inventory count / detail draft preserve (#155–#156)
- Pilot readiness approve gates (#145 / #148 / #149)
- Server-side readiness revalidation (Codex / migrations)

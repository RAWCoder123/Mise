# Reference reconstruction — final verification

Branch: `ui/reference-reconstruction`

Target: `origin/main` at `f69390d5f6b069a1c708b0dbcd037d0ef2ba47d4`

The reconstruction changes presentation and presentation-only QA. Existing
domain, application, repository, tenant, Gmail, Supabase, and local-demo
contracts remain in place.

## Screens rebuilt

- Home: compact brand chrome, specific alert row, metric grid, daily briefing,
  segmented inventory health, and scan-first task rows.
- Today: chip filters, grouped bucket cards, left-column timeline labels, and a
  compact in-card primary action.
- Inventory: compact health summary, grouped low-stock and alert rows, and a
  demoted reorder/count entry point.
- Orders: two-line draft-card header, neutral draft state, item table, two-action
  approval surface, and a supplier-specific collapsed review row.
- Task detail: reference-scale hierarchy while preserving authoritative workflow
  completion state.
- Ask Mise: deterministic seeded exchange, larger Mise mark, priority rows,
  suggestion chips, and tomato send affordance.
- More: compact shortcut tiles and grouped operational/help rows.
- Profile / Settings: reference-scale identity and list hierarchy, untruncated
  restaurant values, integrations/operations preserved, and sign out at the end.
- Setup: numbered rail with solid connectors and a pinned footer.

## Shared components changed

- `Screen`, `RestaurantSwitcher`, and tab layout for application chrome.
- `IconBadge`, `OperationalRow`, `RowGroup`, `StatusNotice`, and the shared
  typography/density/radius tokens for compact list composition.
- `InventoryHealth` and `InventoryHealthSummaryCard` for real, discrete health
  proportions and correctly toned summary values.
- `OperatingPlanTimeline` for bucket-level grouping and timeline-column labels.
- `SupplierDraftCard` for the draft/review composition while preserving the
  Gmail send role gate.
- `SetupStepRail` for numbered, connected setup progress.

## Existing presentation retired or narrowed

- `DailyCloseoutCelebration` is no longer part of Today's first viewport; it is
  retained only in daily-report/brief contexts where the behavior is relevant.
- The old free-floating Home restaurant selector was replaced by the shared
  `RestaurantSwitcher` bound to the brand chrome.
- Decorative gradient health calculations were removed in favor of semantic,
  count-derived segments.
- Per-row floating cards were replaced with grouped surfaces on Today and
  Inventory.

## Backend preservation

- `services/miseService.ts` screen-facing APIs were not changed.
- No domain, repository, schema, migration, Supabase policy, or Edge Function was
  changed by the reconstruction.
- Local demo behavior remains available and was exercised by interaction QA.
- Gmail delivery still uses `canSend={canSendOrders}`; no role or connection
  bypass was introduced.
- Task completion and inventory/order state continue to come from authoritative
  workflow evidence rather than client-only booleans.
- English, Spanish, and Simplified Chinese catalogs remain complete; the
  interaction harness exercised all three layouts.

## Visual comparison

Primary captures are in `docs/design/screenshots/final/`. Side-by-side evidence
is in `docs/design/screenshots/compare-final/`.

| Screen | Result | Evidence | Notes |
| --- | --- | --- | --- |
| Home | PARTIAL | `compare-final/01-home.png` | Chrome, alert, metrics, briefing, health, and task hierarchy converge; live data and the real approval surface make the page longer. |
| Today | PARTIAL | `compare-final/02-today.png` | Bucket tabs, timeline grouping, and in-card action converge; demo tasks without authoritative deadlines remain undated instead of inventing reference times/durations. |
| Inventory | PARTIAL | `compare-final/03-inventory.png` | Health, grouped stock rows, and reorder entry converge; real inventory count and product-imagery omissions remain visible differences. |
| Orders | PARTIAL | `compare-final/04-orders.png` | Draft composition and lanes converge; the Gmail simulation disclosure and a pending recommendation's unknown total/date remain truthful additions. |
| Task detail | PARTIAL | `compare-final/05-task-detail.png` | Hierarchy and fixed actions converge; content reflects the real inventory-count task resolved by the harness. |
| Ask Mise | PARTIAL | `compare-final/06-ask-mise.png` | Seeded exchange, priorities, suggestions, and composer converge; deterministic restaurant reasoning is retained instead of adding an ungrounded LLM. |
| More | PARTIAL | `compare-final/07-more.png` | Shortcut tiles and grouped rows converge; Operations / Team & help grouping preserves the implemented IA. |
| Profile / Settings | PARTIAL | `compare-final/08-settings.png` | Identity and grouped list hierarchy converge; existing operational routes remain reachable below the reference's shorter first viewport. |
| Setup | PARTIAL | `compare-final/09-setup.png` | Progress rail and pinned footer converge; Mise's real starter data and rhythm/POS workflow differ from the reference's empty Email stage. |

There are no FAIL screens. PARTIAL rows are deliberate truth/IA differences,
not unresolved layout defects.

## Verification

| Gate | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 497/497 |
| `npm run security:backend` | PASS |
| `npm run design:static` | PASS |
| `npm run qa:routes` | PASS |
| `npm run qa:mobile-layout` at 390×844 | PASS — zero horizontal overflow |
| `npm run qa:mobile-layout` at 375×812 | PASS — zero horizontal overflow |
| `npm run qa:mobile-layout` at 320×812 | PASS — zero horizontal overflow |
| `npm run qa:interactions` | PASS — core workflow plus Spanish and Simplified Chinese layout passes |

Ask Mise interaction QA types `How are sales today?`, waits for the grounded
sales answer, and verifies the answer's DOM geometry is inside the 390×844
viewport. A direct `/ask-mise` visit without an active restaurant now offers a
local-demo action (when enabled) or a route to setup instead of a dead end.

## Remaining differences

- Today leaves missing deadlines/durations blank or marks them as unset because
  the demo data does not contain authoritative schedule values.
- Orders' collapsed pending-recommendation row cannot show a supplier-order total
  or delivery date before a draft exists.
- More keeps additional real operational destinations in documented groups.
- Settings keeps POS, Gmail, Recipes, Suppliers, Export, Privacy, Support, and
  destructive account actions reachable, making the full page longer.
- Setup reflects the implemented rhythm/POS workflow and seeded demo inventory,
  so its content density and final rail label differ from the static reference.

## Recommendation

**REFERENCE-DRIVEN RECONSTRUCTION — READY FOR PR REVIEW.**

The earlier all-clear wording overstated pixel fidelity. The rendered evidence
supports structural and density convergence, with the PARTIAL differences above
preserving truthful operational state or documented product IA. The branch is
ready to review against the screenshots; it should not be described as a
pixel-identical copy of the static boards.

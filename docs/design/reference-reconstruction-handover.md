# Reference reconstruction — handover

Branch: `ui/reference-reconstruction` (off `main` @ `f69390d`).

This documents what was built, what was measured, and exactly what remains per
screen, so another agent can continue without re-deriving the diagnosis.

Work stopped deliberately: Codex, Cursor and Claude were writing to the same
working tree concurrently, editing the same functions. Visual convergence cannot
be certified on a tree that several agents mutate between a change and its
screenshot, so the loop was handed over rather than continued.

---

## 1. Use the verification loop — it is the whole job

`§22` of the brief is the binding requirement: the redesign is not done because
code changed, it is done when the rendered screens converge. Two tools exist for
this and both work today.

```bash
# Boot Expo web, initialize local demo data, capture all nine screens at 390x844
node scripts/design-screenshots.mjs --out docs/design/screenshots/iter2

# Slice the boards into per-screen references and build side-by-side composites
python3 scripts/design-compare.py \
  --shots docs/design/screenshots/iter2 \
  --out docs/design/screenshots/compare-iter2
```

Then **open the composites as images and look at them.** Do not reason about
whether the code "should" match.

Notes on the harness:

- Captures are at `deviceScaleFactor: 2`, so a 390×844 screen lands as a
  780×1688 PNG. Everything in the raw file is double size. Misreading this
  produces the false conclusion that the whole app is ~1.7× too large; it is not.
- The composite scales the reference panel and the capture to a common height,
  so sizes across the two halves *are* directly comparable.
- The reference panels include an iOS status bar (`9:41`, battery). The web
  capture has none, so the build's content starts roughly 28pt higher than the
  reference. This is a capture artifact, not a design gap — do not "fix" it.
- `05-task-detail` resolves a real task by clicking through Today. If it ever
  falls back to `/tasks/layout-smoke-task` you are screenshotting the empty
  state, not the screen.
- The boards are hand-laid, not a uniform grid: panel widths differ per column
  and the two rows of the primary board are at different scales. Crop bounds are
  measured and pinned in `CLEAN_PANELS` / `WARM_PANELS` in `design-compare.py`.

Baselines already captured: `docs/design/screenshots/before/` (pre-work) and
`iter1/` (after the foundation), with composites in `compare-before/` and
`compare-iter1/`.

---

## 2. What was landed

Verified by screenshot, not by inspection.

| Area | Change |
| --- | --- |
| `constants/theme.ts` | Collapsed the two divergent type scales. `typography` (settings, auth, setup, forms) ran a full rung larger than `conceptTypography` (tabs), which is the mechanical reason the product read as separately designed screens. Both now sit on the reference scale. Added `healthValue`, `orderTotal`, `radii.xs/pill`, retuned `density`. |
| `components/ui/Screen.tsx` | App bar is 52pt, painted on the canvas with **no bottom hairline** — the concept has no chrome bar. Home's brand chrome now carries the wordmark, the bell, and the restaurant chip as one bound block. |
| `components/ui/RestaurantSwitcher.tsx` | New. 26pt chip reaching 44pt via hitSlop, bound to the wordmark instead of floating in scroll content. |
| `components/ui/IconBadge.tsx` | 44px filled circles → 28–32px rounded squares. Circles at that size read as decorative avatars and were the main reason lists felt like a consumer feed. Fixes Home tasks, Inventory rows, and Daily Brief rows at once. |
| `components/ui/InventoryHealth.tsx` | The health bar was a blended gradient that always ran green→tomato regardless of data, so a healthy kitchen and a failing one drew the same bar. Now proportional discrete segments off the real counts. Deleted ~110 lines of dead gradient machinery and a duplicate status→colour map. |
| `components/ui/StatusNotice.tsx` | Row variant clamps to one title line and one message line — the two-line message was why Home's alert was double the reference height. |
| `components/ui/RowGroup.tsx` | New. One bordered surface with hairline-separated rows, for "group by meaning, not per row". **Built but not yet adopted** — see §3. |
| `app/(tabs)/_layout.tsx` | Tab bar 60pt (measured off the concept). |
| `app/(tabs)/home.tsx` | Daily Briefing collapsed from section-header + card-with-its-own-heading into one card with the heading and operating date inside. Alert leads with `restaurantStatus.topRisk`. Metric numerals stay ink. Task rows show "Due 8:30 AM · Manager". Removed the redundant third greeting line. |
| `services/presentation/inventoryHealthPresentation.ts` | Added `inventoryHealthTier`. The chip was hardcoded "Healthy" and announced a 57% kitchen as healthy above a mostly-amber bar. |
| `services/presentation/taskRoleLabel.ts` | New. One role→label mapping so Home, Today and Task detail cannot disagree. |
| `scripts/design-static.mjs` | Updated presentation expectations to the new chrome and added guards: no hairline under the app bar, red active tab, no pill or floating tab container. Security and domain assertions untouched. |

### One regression, caught and corrected by the loop

The tab bar was first set to 56pt, which clipped every label. Measuring the
reference panel gave ~60pt. **This is the argument for the loop**: the change
looked correct in code and typechecked cleanly.

---

## 3. What remains, per screen

Ranked by distance from the reference. Every item below was read off a
side-by-side composite in `docs/design/screenshots/compare-iter1/`.

### Home — PARTIAL, closest to done
- Alert headline truncates: `topRisk` is prose ("Mapped POS sales have pushed
  projected s…"), while the concept headline is a short label ("Low stock:
  Chicken Breast"). Either swap so the status word is the title and `topRisk` is
  the message, or shorten `topRisk` in the brief.
- Metric cell labels are a touch heavier than the reference; try `medium` weight.
- Section headings render slightly larger than the concept's ~13px.

### Today — FAIL, most structural work left
- A large green "Good work — keep going" celebration card sits above the
  timeline. Nothing like it exists in the reference. Remove it. (A concurrent
  agent already began this — `DailyCloseoutCelebration` was unwired from
  `today.tsx`; confirm it is fully retired and unreferenced.)
- Every task is its own card. The concept puts all tasks in a bucket into **one**
  grouped card with hairline separators. `RowGroup` exists for this.
- The bucket name ("Now", "Up next") is a full-width row above the group. The
  concept puts it in the **left timeline column** beside the dot, with the time
  and duration stacked beneath it.
- Times show "No time" / "Aug 12". The concept shows "8:30 AM" over "15 min".
- "Start task" is a full-size button; the concept uses a compact red pill inside
  the first card, bottom-right.
- Bucket grouping must keep coming from `DailyOperatingPlan` — do not
  re-derive it in the screen.

### Inventory — FAIL
- A full-width red "Start count" CTA dominates the first viewport and does not
  exist in the concept. It is real functionality from PR #125/#126 and must stay
  reachable — demote it to a compact row or an app-bar action, do not delete it.
- Low stock / Stock alerts rows are individually boxed; group each section into
  one card and add the "View all" action.
- Filter chips, "Stock list" and the search field are all expanded by default.
  Collapse behind the app-bar search/filter icons; `§12` wants the default screen
  immediately scannable.
- Health chip and bar now share `inventoryHealthTier`; apply it here too.

### Orders — FAIL
- Supplier name truncates ("Metro Produce Sup…") because name, status chip and
  total share one line. The concept gives the name its own line with the status
  chip, then due date and total on the next.
- Status chip is amber "DRAFTED BY MISE"; the concept uses a neutral grey
  uppercase "DRAFT".
- Three actions, one of them a disabled-looking pink "Simulate send", plus a
  stray "Copy". The concept has exactly two: "Edit draft" and "Review order".
  **Preserve the Gmail safety boundary and the operator approval step** while
  restructuring — see the warning in §4.
- The second lane item renders as a plain "Needs review" notice instead of a
  collapsed order card.
- Supplier spend belongs in Sent/History, not the Draft lane. Use
  `fetchSupplierSpendTrend`; do not fabricate spend.

### Task detail — needs re-measurement
- Was captured as the empty state before the harness could resolve a real task.
  It now resolves one; re-capture and diff before assuming anything.
- Keep completion derived from authoritative workflow state. Commit `cdb606a`
  ("Rebuild Task Detail and stop faking the checklist") is deliberate — do not
  turn the checklist back into client-side boolean state.

### Ask Mise — PARTIAL
- Greeting is one run-on grey paragraph; the concept has a bold "Hi Raymond! I'm
  Mise." over a lighter second line, beside a larger red Mise mark.
- Empty state leaves a large void. The concept shows an exchange.
- Send affordance is grey; the concept's is Mise red.
- Deterministic implementation is acceptable. **Do not add an LLM.**

### More — PARTIAL
- Rows ~60pt against the reference's ~48pt.
- Ten flat entries. `§16` explicitly asks for Operations / Management grouping —
  this is a sanctioned deviation from the six flat rows in the concept.
- Copy: "Tasks" → "Create task", "Waste analysis" → "Waste", "Activity history"
  → "Activity", "Help resources" → "Help & resources".

### Profile / Settings — FAIL
- "Sign out" sits mid-list with more sections beneath it. It belongs at the end.
- Value text truncates (`America/Ne…`) — `OperationalRow.value` has
  `maxWidth: 96`, too tight for timezone strings.
- Section labels band the page because headers sit on canvas while rows are
  white. The concept is one white page with hairline separators.
- Read-only info rows (Timezone, Currency, Service style) are mixed with
  navigation rows.
- All existing routes (POS, Gmail, Suppliers, Recipes, Team, Export, Privacy,
  Support) must stay reachable — place them, do not drop them.

### Setup — PARTIAL
- Step rail uses green check circles and dashed connectors; the concept uses
  numbered circles with a solid dark connector for completed segments.
- Footer ("Continue" / "Skip for demo") scrolls; the concept pins it.
- Keep existing provisioning and auth rules. Do not reintroduce inline
  restaurant creation if the architecture removed it deliberately.

---

## 4. Warnings for whoever continues

**The Gmail send boundary is pinned by a test, on purpose.** During this session
a concurrent edit changed `app/(tabs)/orders.tsx` from
`canSend={canSendOrders}` to `canSend={usingLocalDemo || canSendOrders}`.
`canSendOrders` is `canManage && gmailIsConnected`, so the edit let a staff-role
member reach send whenever local demo was active. Sends are simulated in demo, so
no real email could go out, but it bypassed the role check in the UI and broke
`tests/ordersUi.test.ts:45`, which exists to hold exactly that line. It has been
reverted and the suite is green again. When Orders is restructured, the two-action
layout must keep `canSend` gated on `canSendOrders`.

**Do not weaken security or domain tests** to accommodate a new layout.
Presentation-specific expectations in `scripts/design-static.mjs` are fair to
update; assertions about roles, tenancy, and send safety are not.

**Deliberate deviations from the reference**, already agreed and recorded in
`reference-reconstruction.md`:

- No illustration in the Daily Briefing card, and no photographic food
  thumbnails in Inventory. `AGENTS.md` forbids decorative artwork and commit
  `5053ba1` retired `MiseIllustrations.tsx`. Use restrained category line icons.
- Sans throughout the shell, including the Setup title that the secondary board
  sets in a serif. The primary board is sans everywhere and `§6` follows it.
- `More` grouped into Operations / Management rather than six flat rows.

---

## 5. Gate status at handover

| Gate | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 497/497 |
| `npm run security:backend` | PASS |
| `npm run design:static` | PASS |
| `npm run qa:routes` | NOT RUN since the foundation landed |
| `npm run qa:mobile-layout` | NOT RUN since the foundation landed |
| `npm run qa:interactions` | NOT RUN since the foundation landed |

The three QA harnesses must be re-run before any PR: the chrome height and tab
bar changes are exactly the kind of thing `qa:mobile-layout` is there to catch.
`npm audit` and `expo-doctor` fail for the pre-existing upstream Expo reasons
documented in PR #121 — report them separately and never run
`npm audit fix --force`.

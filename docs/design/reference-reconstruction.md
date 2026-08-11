# Mise UI reference reconstruction

Source of truth: `docs/design/references/ui-clean-mobile.png` (primary) and
`ui-warm-mobile.png` (secondary). Sliced per-screen copies live in
`docs/design/references/screens/`.

Tooling:

- `node scripts/design-screenshots.mjs --out docs/design/screenshots/<label>` boots
  Expo web, initializes local demo data, and captures the nine reference screens
  at 390×844.
- `python3 scripts/design-compare.py --shots <dir> --out <dir>` slices the boards
  and writes side-by-side reference/build composites.

## Diagnosis of the pre-reconstruction build

Captured in `docs/design/screenshots/before/`. The information architecture was
already close; what diverged was composition.

| Screen | Structural gap against the reference |
| --- | --- |
| Home | Daily Brief is a card nested inside a section that repeats its own heading; alert is a tall generic "At risk" block instead of a specific one-line stock alert; metric labels too heavy; health bar is a decorative gradient rather than segmented; task rows carry large circular tinted icon badges and "Later"/"No time" copy instead of due time and role. |
| Today | A large green celebration card the reference does not have sits above the timeline; every task is its own card instead of one grouped card per bucket; the bucket name is a full-width row instead of living in the left timeline column beside the dot. |
| Inventory | A full-width red "Start count" CTA dominates the first viewport; rows are individually boxed instead of grouped per section; filter chips, "Stock list" and a search field are all expanded by default; health bar is a gradient. |
| Orders | Supplier name truncates because the name, status chip and total share one line; three actions (one disabled) instead of the reference's two; the second lane item is a plain notice instead of a collapsed order card. |
| Task detail | Fell back to the empty state in capture; heading uses the editorial serif. |
| Ask Mise | Greeting is one run-on gray paragraph; no seeded exchange, leaving a large void; send affordance is gray rather than Mise red. |
| More | Rows ~60pt against the reference's ~48pt; ten ungrouped entries. |
| Profile | `Sign out` sits mid-list with more sections beneath it; value text truncates (`America/Ne…`); section labels band the page because headers sit on canvas while rows are white. |
| Setup | Step rail uses green check circles and dashed connectors instead of numbered circles with a solid completed connector; footer actions scroll instead of pinning. |

## Component strategy

| Component | Decision | Rationale |
| --- | --- | --- |
| `constants/theme.ts` | MODIFY | Collapse the duplicate `typography` / `conceptTypography` scales into one reference-scale system; retune density. |
| `components/ui/Screen.tsx` | REPLACE | Home needs brand, bell and restaurant selector in one top block; other tabs need a compact title bar with no hairline against the canvas. |
| `app/(tabs)/_layout.tsx` | MODIFY | Smaller icon and label geometry, 56pt bar. |
| `SectionHeader` | MODIFY | 13px bold label with a red trailing action. |
| `OperationalRow` | MODIFY | Tighter rhythm, square icon tiles, wider value column, optional chevron. |
| `CompactMetricStrip` | REPLACE by `MetricGrid` | Reference uses one bordered card with hairline cell dividers. |
| `InventoryHealth`, `InventoryHealthSummaryCard` | MODIFY | Segmented health bar carrying real status proportions instead of a decorative gradient. |
| `SegmentedControl` | MODIFY | Reference chip row: solid red active, hairline inactive with a muted count. |
| `SupplierDraftCard` | REPLACE by `SupplierOrderCard` | Two-line header, item table, exactly two actions. |
| `ActionTile` | MODIFY | Reference shortcut tile geometry. |
| `Button`, `Badge` | MODIFY | Compact variants at reference scale. |
| `OperationalHero`, `DailyCloseoutCelebration` | RETIRE from Today | Decorative morale surfaces absent from the reference. |
| `RowGroup`, `TimelineGroup`, `HealthBar`, `AlertRow`, `MenuGroup`, `SettingsRow`, `PriorityBadge` | ADD | Each pattern is visibly shared across two or more reference screens. |

## Deliberate deviations from the reference

- **No illustration in the Daily Briefing card and no photographic food
  thumbnails in Inventory.** `AGENTS.md` forbids decorative artwork and commit
  `5053ba1` retired `MiseIllustrations.tsx`. Restrained category line icons carry
  the same composition without reintroducing cartoon art. Warmth is carried by
  the copy and the card grouping instead.
- **Sans throughout the application shell**, including the Setup title that the
  secondary board renders in a serif. The primary board is sans everywhere and
  the task brief directs the product language to follow it.
- **`More` is grouped into Operations / Management.** The reference shows six
  flat rows; Mise has more operational surfaces that must stay reachable.

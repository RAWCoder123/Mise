# MISE-005WO Home ApprovalsSection card.title ASCII C (2026-11-02)

## Defect

Home ApprovalsSection always passed raw `card.title` into the cardTitle Text:

```ts
<Text style={styles.cardTitle}>{card.title}</Text>
```

Unicode-only-space and empty string titles still rendered a blank-looking
approval identity on Needs-your-approval cards, so no intentional localized
fallback owned blank-looking approval titles for that path. Unicode `.trim()`
on padded approval titles would invent clean display titles before rendering
them into the cardTitle.

## Fix

- `services/domain/presentationHomeApprovalsCardTitleIdentity.ts`
- Soft-null via `normalizeHomeApprovalsCardTitle` (ASCII C single-line: ASCII
  end trim only; preserve NBSP — no fold; full C0/DEL reject) before the
  cardTitle Text on `app/(tabs)/home.tsx` ApprovalsSection (1 site). Soft-null
  titles fall through to new localized `t("home.approvals.cardTitle.none")`
  (EN / ES / zh-Hans).

## Ownership

Owns only Home ApprovalsSection `card.title` presentation that falls through to
`home.approvals.cardTitle.none` when soft-null. Does **not** own Home
StatusNotice approval titles (#1011 / MISE-005VC), Home greeting restaurant.name
(#1044 / MISE-005WJ), ApprovalsSection `recommendedAction` / `whyItMatters`
body copy, operating-brief domain title construction, Settings Gmail
connectionSubtitle restaurant.name (#1048 / MISE-005WN), Settings workspace
item.name (#1047 / MISE-005WM), Team / Ask Mise / Autonomy / Memory / Activity /
Support / Privacy / Count / Insights restaurant.name subtitle tips. Alone-OK
relative to those open tips and sibling candidates.

## Inventing / bypass proof

- Raw `"\u2003"` `card.title` previously still rendered as the cardTitle Text,
  with no localized none fallback
- Raw `""` `card.title` same blank-title bypass
- `"\u2003Approve chicken reorder\u2003".trim() === "Approve chicken reorder"`
  inventing equality
- ASCII C soft-null restores the localized `home.approvals.cardTitle.none`
  fallback for the ApprovalsSection cardTitle Text

## Verification

- Focused `tests/homeApprovalsCardTitleAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm test` (expect inherited recalculationCycles cancellations only)

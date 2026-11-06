# Inventory count session catch Error.message ASCII C (MISE-005YI)

Date: 2026-11-06
Branch: `cursor/mise-inventory-count-session-error-ascii-c`
Base: `origin/main` @ `78da7376`

## Problem

Inventory count session catch sites selected their operator notice with:

```ts
setError(caught instanceof Error ? caught.message : t("inventory.count.*Error"));
```

Any `Error` forced the raw `Error.message` branch with no ASCII C prep,
soft-null, or length bound. Empty, Unicode-only-space, and em-space/NBSP-padded
diagnostics invented blank or unclean operator notices and bypassed the
intentional localized start/save/submit/approve/cancel fallbacks.

## Changes

- Add `services/domain/inventoryCountSessionErrorMessageIdentity.ts`
  (multiline operator_note-style ASCII C prep; soft-null on empty /
  Unicode-padded / unsafe controls; max 220 after prep)
- Route all six Inventory count catch call sites through
  `describeInventoryCountSessionError(..., t("inventory.count.*Error"))`
- Leave Inventory detail submitError (#1139 / MISE-005YG), Log Delivery
  submitError (#1140 / MISE-005YH), count-sheet note (#885), and
  `message ?? notFound` alone

## Inventing / bypass proof

- Prior `instanceof Error ? caught.message : fallback` displayed
  `new Error("")` as a blank notice and `new Error("\u2003…\u2003")` as a
  padded diagnostic instead of the localized catalog copy
- `"\u2003Count submit failed.…\u2003".trim() === "Count submit failed.…"`
  inventing equality shows why Unicode trim cannot authorize a clean notice
- ASCII C soft-null restores the localized `inventory.count.*Error` fallthrough

Distinct from Inventory detail submitError (#1139), Log Delivery submitError
(#1140), and from recalculation / account-deletion / Gmail / Square
error-haystack tips.

## Alone-OK

No migration. Alone-OK on main beside #1140 / #1139 / #1138 / #1100–#1137 /
#928–#933; ordinary conflicts possible only if another tip rewrites the same
Inventory count catch sites.

## Verification

- Focused `tests/inventoryCountSessionErrorMessageAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm run design:static`
- `npm test`

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.

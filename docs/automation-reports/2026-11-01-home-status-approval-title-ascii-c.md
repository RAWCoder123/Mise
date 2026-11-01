# MISE-005VC: Home StatusNotice approval title ASCII C

Date: 2026-11-01  
Branch: `cursor/mise-home-status-approval-title-ascii-c`

## Problem

Home restaurant-status `StatusNotice` selected its headline with:

```ts
primaryApproval?.title || t(statusKey)
```

A Unicode-only-space title (`"\u2003"`) is raw-truthy while `.trim()` empties it, so the intentional localized status fallback (`home.status.attention_needed` / `home.status.at_risk`) was bypassed and the notice could render a blank headline. Separately, Unicode `.trim()` on padded approval titles would invent a clean display identity (`"\u2003Approve chicken reorder\u2003".trim() === "Approve chicken reorder"`).

## Change

- Add `services/domain/homeStatusApprovalTitleIdentity.ts` with ASCII C single-line prep (ASCII end-trim only; refuse NBSP/em-space padding and ASCII controls).
- Route StatusNotice approval-title selection through soft `normalizeHomeStatusApprovalTitle` so empty / Unicode-padded / unsafe titles fall through to `t(statusKey)`.
- Leave `topRisk?.trim()` emptiness gate, `whyItMatters`, menu-risk item names, ApprovalsSection card titles, and Home greeting tips (#961 / #997) alone.

## Inventing / bypass proof

- `Boolean("\u2003") === true` and `"\u2003" || "FALLBACK" !== "FALLBACK"` (fallback bypass).
- `"\u2003Approve chicken reorder\u2003".trim() === "Approve chicken reorder"` (Unicode-trim inventing).
- ASCII C normalize soft-nulls both classes so `approvalTitle || t(statusKey)` restores the localized status headline.

## Verification

- Focused `tests/homeStatusApprovalTitleAsciiC.test.ts`
- `npm run typecheck`
- `npm test` (expect inherited recalculationCycles cancellations only)

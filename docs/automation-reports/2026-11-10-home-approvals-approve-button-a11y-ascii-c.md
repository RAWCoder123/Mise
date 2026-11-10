# MISE-005ACA Home Approvals approve-button a11y card.title ASCII C (2026-11-10)

## Defect

Home ApprovalsSection Needs-your-approval action Buttons had no
`accessibilityLabel`. VoiceOver / TalkBack only heard the visible "Approve" /
"Review" / "Approving…" chrome, with no approval-card title identity. When a
title is supplied for new a11y chrome, empty / Unicode-only-space titles must
not interpolate blank-looking identity, and Unicode `.trim()` on padded titles
must not invent a clean approval title.

## Fix

- `services/domain/presentationHomeApprovalsApproveButtonTitleIdentity.ts` —
  ASCII C single-line prep (end trim only; preserve NBSP; full C0/DEL reject)
- Soft-null via `normalizeHomeApprovalsApproveButtonTitle` before
  `home.approvals.approveAccessibility` / `reviewAccessibility` interpolations
- Localized fallback `home.approvals.approveAccessibility.title.none`
  (EN / ES / zh-Hans)
- `accessibilityState={{ disabled: Boolean(approvingId) }}` on the same Button

## Alone-OK

Leaves ApprovalsSection `cardTitle` Text display (#1049 / MISE-005WO),
`recommendedAction` cardBody (#1134 / MISE-005YB), `whyItMatters` meta line
(#1135 / MISE-005YC), and Home StatusNotice approval titles (#1011 /
MISE-005VC) alone. Does not share those identity modules.

## Inventing / bypass proof

- Prior ApprovalsSection Button had no `accessibilityLabel`
- `"\u2003Approve chicken reorder\u2003".trim() === "Approve chicken reorder"`
  inventing equality
- ASCII C soft-null restores localized
  `home.approvals.approveAccessibility.title.none`

## Verification

- Focused `tests/homeApprovalsApproveButtonTitleAsciiC.test.ts` (5/5;
  **62** assertion call sites counted from source)
- `npm run typecheck`
- `npm run security:static`
- `npm run design:static`

Baseline: `origin/main` @ `78da7376`

## Classification

Controlled pilot-ready accessibility tip. Not App Store submission-ready.

# MISE-005UL setup ingredient validation label ASCII C

Date: 2026-10-30

## Summary

Stop Unicode `.trim()` on setup ingredient validation labels from inventing
clean ingredient chrome via em-space / NBSP padding
(`'\u2003Roma Tomatoes\u2003'.trim() === 'Roma Tomatoes'`).

Route validation label prep through ASCII C end-trim identity that soft-nulls
when Unicode trim would still strip end padding. Soft empty / Unicode-only
space keeps the intentional `|| t("setup.validation.ingredientLabel", …)`
fallback.

Open tip #975 / MISE-005UK explicitly left these ingredient validation labels
alone.

## Changes

- Add `services/domain/presentationSetupIngredientValidationLabelIdentity.ts`
- Wire ingredient validation labels in `app/(auth)/setup.tsx`
- Focused inventing proofs in
  `tests/presentationSetupIngredientValidationLabelAsciiC.test.ts`
- Leave recipe validation labels (#975), setup inventory validation labels
  (#974), setup supplier ChoiceChip labels (#973), durable `supplierNames`
  (#904), setup-screen supplier identity (#696), supplier name/email saves
  (#680), inventory item names (#903), Create Task assignee chips (#963),
  Login email chips (#971), and supplier draft line labels (#972) alone

## Verification

- Focused AsciiC 3/3
- `npm run typecheck` pass
- `npm run security:static` / `security:backend` pass
- `npm test`: 686 total / 679 pass / 0 fail / 7 cancelled (inherited recalculationCycles)
- Docker pgTAP unavailable in this environment

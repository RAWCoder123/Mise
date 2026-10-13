# MISE-005OX finding recommended-action ASCII C multiline free-text prep

Date: 2026-10-13  
Branch: `cursor/mise-finding-recommended-action-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

Domain `requireBoundedText` Unicode-trimmed original `recommendedAction` and
`editedRecommendedAction` on decision input + hosted response hydrate.
Em-space padding invented a clean free-text body
(`'\u2003Order chicken before lunch service.\u2003'.trim() === 'Order chicken before lunch service.'`).

ASCII C multiline free-text prep folds NBSP, trims only C-locale
`[[:space:]]` from the ends, and leaves em-space alone so it cannot invent
equality with an unpadded recommended action. Internal LF/TAB/CR are preserved
(operator_note-style). Empty / Unicode-only spaces stay hard-invalid with the
prior label-specific messages.

## Change

- `services/domain/operationalFindingRecommendedActionIdentity.ts`
- Route decision-input and hydrate original / edited recommended-action fields
  via `requireCanonicalOperationalFindingRecommendedAction` and
  `requireCanonicalOperationalFindingEditedRecommendedAction`
- Multiline control allowlist: reject C0/DEL except LF/TAB/CR
- Left sibling evidence summary / evidence type / evidence id / restaurant
  workspace / event identities on Unicode trim
- Distinct from open SQL cntrl pin #554 and open evidence-summary tip #831

## Verification

See commit message / PR for focused + suite results.

## Merge

Alone-OK. Keep module separate from #790–#799 finding-decision identity tips
and from evidence-summary free-text (#831 / MISE-005OW). When landing with
sibling tips, drop mutual Unicode-trim cross-assertions.

# MISE-005OW finding evidence summary ASCII C multiline free-text prep

Date: 2026-10-13  
Branch: `cursor/mise-finding-evidence-summary-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

Domain `requireBoundedText` Unicode-trimmed evidence `summary` on decision
input + hosted response hydrate. Em-space padding invented a clean summary
(`'\u2003Chicken has less than one service day of coverage.\u2003'.trim() === 'Chicken has less than one service day of coverage.'`).

ASCII C multiline free-text prep folds NBSP, trims only C-locale
`[[:space:]]` from the ends, and leaves em-space alone so it cannot invent
equality with an unpadded summary. Internal LF/TAB/CR are preserved
(operator_note-style). Empty / Unicode-only spaces stay hard-invalid.

## Change

- `services/domain/operationalFindingEvidenceSummaryIdentity.ts`
- Route `normalizeEvidence` `summary` via
  `requireCanonicalOperationalFindingEvidenceSummary`
- Multiline control allowlist: reject C0/DEL except LF/TAB/CR
- Left sibling recommended-action / edited-recommended-action /
  evidence type / evidence id / restaurant workspace / event identities on
  Unicode trim
- Distinct from open SQL cntrl pin #554

## Verification

See commit message / PR for focused + suite results.

## Merge

Alone-OK. Keep module separate from #790–#799 finding-decision identity tips
and from recommended-action free-text (next sibling). When landing with sibling
tips, drop mutual Unicode-trim cross-assertions.

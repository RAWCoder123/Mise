# MISE-005OP restaurant-tasks completionResult ASCII C multiline free-text prep

Date: 2026-10-12  
Branch: `cursor/mise-restaurant-tasks-completion-result-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

Domain `requiredText` Unicode-trimmed and `\s`-collapsed `completionResult` on
complete, and `optionalText` Unicode-trimmed it on hydrate. Em-space padding
invented a clean result
(`'\u2003Counted 18 lb\u2003'.trim().replace(/\s+/g, " ") === 'Counted 18 lb'`).
Mid-string em-space and internal LF were likewise collapsed into ordinary
ASCII spaces on the required complete path.

ASCII C multiline free-text prep folds NBSP, trims only C-locale
`[[:space:]]` from the ends, and leaves em-space alone so it cannot invent
equality with an unpadded result. Internal LF/TAB/CR are preserved
(operator_note-style). Complete-path empty stays invalid; hydrate soft empty
stays `null`.

## Change

- `services/domain/restaurantTasksCompletionResultIdentity.ts`
- Route complete via `requireCanonicalRestaurantTasksCompletionResult`
- Route hydrate via `normalizeCanonicalRestaurantTasksCompletionResult`
- Multiline control allowlist: reject C0/DEL except LF/TAB/CR
- Left sibling title / detail / relatedSupplierName / sourceReference /
  durable-ID tips alone
- Distinct from open SQL cntrl pin #554

## Verification

See commit message / PR for focused + suite results.

## Merge

Alone-OK. Keep modules separate from #808–#823 sibling tips; do not merge
error contracts. When landing with sibling tips, drop mutual Unicode-trim
cross-assertions.

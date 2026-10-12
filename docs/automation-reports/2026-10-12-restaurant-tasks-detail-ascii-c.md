# MISE-005OO restaurant-tasks detail ASCII C multiline free-text prep

Date: 2026-10-12  
Branch: `cursor/mise-restaurant-tasks-detail-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

Domain `optionalText` Unicode-trimmed `detail` on create + hydrate. Em-space
padding invented a clean detail
(`'\u2003Count the walk-in case.\u2003'.trim() === 'Count the walk-in case.'`).

ASCII C multiline free-text prep folds NBSP, trims only C-locale
`[[:space:]]` from the ends, and leaves em-space alone so it cannot invent
equality with an unpadded detail. Internal LF/TAB/CR are preserved
(operator_note-style). Soft empty / Unicode-only spaces → `null`.

## Change

- `services/domain/restaurantTasksDetailIdentity.ts`
- Route create + hydrate `detail` via `normalizeCanonicalRestaurantTasksDetail`
- Multiline control allowlist: reject C0/DEL except LF/TAB/CR
- Left sibling title / relatedSupplierName / sourceReference /
  completionResult / durable-ID tips alone
- Distinct from open SQL cntrl pin #554

## Verification

See commit message / PR for focused + suite results.

## Merge

Alone-OK. Keep modules separate from #808–#822 sibling tips; do not merge
error contracts. When landing with sibling tips, drop mutual Unicode-trim
cross-assertions.

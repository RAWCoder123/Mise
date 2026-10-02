# MISE-005FR: sales_imports.error_message cntrl locale pin

## Summary

Additive CHECK-only migration attaches `sales_imports_error_message_check`
as null OR `length(trim(error_message)) between 1 and 200` plus
`error_message collate "C" !~ '[[:cntrl:]]'`.

The backbone column was nullable text with no CHECK. Square sync failure
writers already persist `left(safe_code, 200)` after `gmail_safe_error_code`;
this tip locks that bound and closes LC_CTYPE dump/restore drift for
sales-import failure labels (single-line system codes despite the column name).

## Scope

- CHECK-only; does not rewrite Square sync SECURITY DEFINER writers
- Leaves `source_file_name` (#474), Manual CSV import (#265),
  activity_events.error_message (#581), and mise_actions.error_message (#580)
  untouched
- Does not expand to `^[a-z0-9_]{1,80}$` charset allowlist (cntrl-only)

## Verification

- `npm run typecheck`
- focused `salesImportsErrorMessageCntrlLocalePin`
- `npm test`
- pgTAP plan derived from assertion call sites (Docker may be unavailable)

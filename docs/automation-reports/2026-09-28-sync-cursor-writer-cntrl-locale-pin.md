# MISE-005BP: Square sync_cursor writer cntrl locale pin

**Date:** 2026-09-28  
**Branch:** `cursor/mise-sync-cursor-writer-cntrl-locale-pin`  
**Base:** `origin/main` @ `78da737`

## Change

Additive migration `20260928150000_mise_005bp_sync_cursor_writer_cntrl_locale_pin.sql` rewrites `private.service_apply_square_sync_result_scoped` so `p_sync_cursor` is normalized and rejected under COLLATE `"C"` before prepare / base apply:

```sql
normalized_sync_cursor := nullif(left(coalesce(p_sync_cursor, ''), 500), '');
if normalized_sync_cursor is not null
  and normalized_sync_cursor collate "C" ~ '[[:cntrl:]]'
then
  raise exception 'Square sync cursor is invalid' using errcode = '22023';
end if;
```

The normalized (possibly NULL) cursor is forwarded to `private.service_apply_square_sync_result_mise_003a_base`. `service_role` EXECUTE is preserved; `public` / `anon` / `authenticated` remain revoked.

## Why

MISE-005BM (#473) pins `public.pos_integrations.sync_cursor` with a nullable length 1–500 + COLLATE C cntrl CHECK. The scoped writer still forwarded raw `p_sync_cursor` into the base apply, which stores `nullif(left(coalesce(...), 500), '')` with no cntrl gate. Locale drift could therefore disagree with the restored CHECK (or only fail at CHECK time after expensive prepare work). This tip closes the writer side with a clear `22023` before durable apply.

## Out of scope

- Does not reattach `pos_integrations_sync_cursor_check` (MISE-005BM)
- Does not rewrite `service_apply_square_sync_result_mise_003a_base`, `prepare_square_sales_for_authority`, begin/fail authority sync, or Square OAuth / location stacks (#236/#460/#465)
- Does not change Edge callers (they currently pass `p_sync_cursor: null`)

## Compose

Prefer after MISE-005BM (#473) so CHECK + writer pins land together. Timestamp after MISE-005BO (#475). Compose-safe alone on main; no shared CHECK reattach with #473.

## Verification

- Static tests in `tests/syncCursorWriterCntrlLocalePin.test.ts`
- pgTAP fixture committed (not executed here without Docker)

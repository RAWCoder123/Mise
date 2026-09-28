-- MISE-005BQ: pin public.purchase_lines.normalized_item_key length + cntrl
-- CHECK to COLLATE "C" (NULL allowed).
--
-- public.purchase_lines.normalized_item_key is still length-only (1–500) with
-- no control-character gate. MISE-005A pinned private.normalize_purchase_item_key
-- (and the fold/pack helpers) to COLLATE "C" so the key derivation itself is
-- locale-stable, and purchase_lines_normalized_key_check still requires the
-- stored key to equal normalize(raw_item_description). Open MISE-005F (#414)
-- reattached cntrl COLLATE "C" on source_document_reference,
-- raw_item_description, unit_of_measure, and pack_size — but left
-- normalized_item_key on the length-only inline CHECK.
--
-- normalized_item_key is the durable machine identity used for purchase-line
-- netting, indexes, and learning continuity. Authenticated clients hold
-- SELECT only; writers go through SECURITY DEFINER ingest/append. Even with
-- the normalize equality CHECK, a ctype-dependent length-only sibling gate
-- leaves dump/restore continuity weaker than the four text fields already
-- pinned: under LC_CTYPE drift, restore could disagree on whether a stored
-- key byte is acceptable while the append-only ledger cannot be rewritten.
--
-- This cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster. POSIX character classes follow database LC_CTYPE.
--
-- Scope:
--   - Replace the length-only normalized_item_key CHECK with a named
--     nullable CHECK:
--       normalized_item_key is null
--       or (
--         length(normalized_item_key) between 1 and 500
--         and normalized_item_key collate "C" !~ '[[:cntrl:]]'
--       )
--   - length (not trim) matches the existing foundation CHECK and the
--     normalize() output contract (already btrimmed).
-- Does NOT drop or rewrite purchase_lines_normalized_key_check (normalize
-- equality). Does NOT rewrite private.normalize_purchase_item_key /
-- purchase_line_text / purchase_line_has_control_characters (#414),
-- ingest_purchase_lines / append_purchase_line (#397/#398/#415), currency
-- (#446), or the four text CHECKs already owned by #414.
-- Timestamp after MISE-005BP (#476 sync_cursor writer cntrl preflight).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.purchase_lines'::regclass
      and con.contype = 'c'
      and con.conname <> 'purchase_lines_normalized_key_check'
      and (
        con.conname = 'purchase_lines_normalized_item_key_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%normalized_item_key%'
          and pg_get_constraintdef(con.oid) ilike '%length%normalized_item_key%'
          and pg_get_constraintdef(con.oid) not ilike '%normalize_purchase_item_key%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.purchase_lines drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.purchase_lines
  drop constraint if exists purchase_lines_normalized_item_key_check;

alter table public.purchase_lines
  add constraint purchase_lines_normalized_item_key_check check (
    normalized_item_key is null
    or (
      length(normalized_item_key) between 1 and 500
      and normalized_item_key collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint purchase_lines_normalized_item_key_check
  on public.purchase_lines is
  'MISE-005BQ: optional normalized_item_key length 1–500 with ASCII C [[:cntrl:]] rejection (COLLATE "C").';

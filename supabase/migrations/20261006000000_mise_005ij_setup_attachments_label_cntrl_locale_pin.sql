-- MISE-005IJ: pin public.setup_attachments.label CHECK to reject control
-- characters under COLLATE "C", and align the table bound with the writer.
--
-- setup_attachments_metadata_only_check only enforced
--   length(trim(label)) > 0
-- plus metadata storage_status = metadata_only. It had no upper length bound
-- and no control-character gate. save_restaurant_setup already rejects labels
-- outside length 1..240 after trim, but the table CHECK did not.
--
-- Bare POSIX [[:cntrl:]] follows database LC_CTYPE; this cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; sibling tips
-- re-pin text CHECKs with `collate "C" !~ '[[:cntrl:]]'`.
--
-- Setup attachment label is the durable single-line operator-visible name for
-- a metadata-only onboarding import reference. It is not multiline prose and
-- must not accept LF/TAB/CR/NUL. If LC_CTYPE drifted under a bare (or missing)
-- cntrl gate, dump/restore could accept label bytes a restored C-locale path
-- would refuse — or the reverse — breaking setup-attachment continuity across
-- restore. Without an upper bound, a bypass of the RPC could also store an
-- unbounded label the writer would refuse.
--
-- Scope:
--   - Reattach setup_attachments_metadata_only_check preserving
--     metadata_only storage_status PLUS label length 1..240 after trim PLUS
--     ASCII control rejection under COLLATE "C"
-- Does NOT rewrite save_restaurant_setup / atomic setup writers, kind/status
-- vocabulary (#543), RLS policies, or pilot vocabulary pins.
-- Timestamp after MISE-005II (#651).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.setup_attachments'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'setup_attachments_metadata_only_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%label%'
          and pg_get_constraintdef(con.oid) ilike '%storage_status%'
          and pg_get_constraintdef(con.oid) ilike '%metadata_only%'
          and pg_get_constraintdef(con.oid) not ilike '%kind%'
          and pg_get_constraintdef(con.oid) not ilike '%queued%'
          and pg_get_constraintdef(con.oid) not ilike '%csv%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.setup_attachments drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.setup_attachments
  drop constraint if exists setup_attachments_metadata_only_check;

alter table public.setup_attachments
  add constraint setup_attachments_metadata_only_check check (
    length(trim(label)) between 1 and 240
    and label collate "C" !~ '[[:cntrl:]]'
    and metadata ? 'storage_status'
    and metadata->>'storage_status' = 'metadata_only'
  );

comment on constraint setup_attachments_metadata_only_check on public.setup_attachments is
  'MISE-005IJ: setup attachment label length 1..240 after trim plus ASCII control rejection under COLLATE "C"; metadata remains storage_status=metadata_only.';

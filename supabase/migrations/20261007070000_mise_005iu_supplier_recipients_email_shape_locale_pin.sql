-- MISE-005IU: pin public.supplier_recipients.email mailbox-shape CHECK to
-- COLLATE "C", while preserving length/trim/nullability and ASCII C cntrl
-- rejection.
--
-- supplier_recipients_email_format_check (supplier_recipient_management)
-- already enforces length 3–254, trimmed storage, bare POSIX [[:cntrl:]]
-- rejection, and a mailbox shape regex that uses [[:space:]]. Bare POSIX
-- classes follow database LC_CTYPE. This cluster runs libc en_US.UTF-8.
-- MISE-005A proved locale drift on this cluster.
--
-- MISE-005K (#419) re-pins name/email [[:cntrl:]] under COLLATE "C" but leaves
-- the positive mailbox-shape `~` on bare `email` — so [[:space:]] in that
-- shape still follows database ctype. Sibling mailbox tips (MISE-005L/M/IF/IM)
-- pin shape as `email collate "C" ~ ...[[:space:]]...`.
--
-- email is the durable supplier-send To mailbox. If LC_CTYPE drifted under a
-- bare shape gate, dump/restore could accept recipient mailbox bytes a
-- restored C-locale path would refuse — or the reverse — breaking send
-- readiness and To-address continuity across restore.
--
-- Scope:
--   - Reattach supplier_recipients_email_format_check preserving exact
--     length/trim/nullability PLUS email collate "C" !~ [[:cntrl:]] PLUS
--     email collate "C" ~ mailbox shape (same [^@[:space:]] class as foundation)
-- Does NOT reattach name_bounds (#419), rewrite upsert_supplier_recipient /
-- setup RPCs, or tip outreach/users/gmail mailbox siblings.
-- Timestamp after MISE-005IT (#662). Alone-OK on main; field-level conflict
-- with #419 email_format reattach — land after #419 or rebase #419 to keep
-- name_bounds only.

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.supplier_recipients'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'supplier_recipients_email_format_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%email%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%email%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
            or pg_get_constraintdef(con.oid) ilike '%[[:space:]]%'
            or pg_get_constraintdef(con.oid) ilike '%@%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%supplier_name%'
          and con.conname is distinct from 'supplier_recipients_name_bounds_check'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.supplier_recipients drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.supplier_recipients
  drop constraint if exists supplier_recipients_email_format_check;

alter table public.supplier_recipients
  add constraint supplier_recipients_email_format_check check (
    email is null or (
      pg_catalog.length(email) between 3 and 254
      and email = pg_catalog.btrim(email)
      and email collate "C" !~ '[[:cntrl:]]'
      and email collate "C" ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    )
  );

comment on constraint supplier_recipients_email_format_check
  on public.supplier_recipients is
  'MISE-005IU: optional supplier To-email length 3–254, trimmed, ASCII C [[:cntrl:]] rejection, and [[:space:]] mailbox shape under COLLATE "C".';

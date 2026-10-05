-- MISE-005IK: pin public.restaurant_email_connections.sender_email CHECK to
-- the durable Gmail From mailbox shape under COLLATE "C".
--
-- public.restaurant_email_connections.sender_email was declared as nullable
-- text with no length, lower, cntrl, or mailbox-shape gate (email scaffolding
-- 20260622053735). Backend OAuth writers copy the connected From from
-- private.gmail_credentials.sender_email and clear it to null on disconnect.
-- Sibling tips already pinned:
--   - private.gmail_credentials.sender_email shape (#423 / MISE-005O)
--   - restaurant_email_connections.provider (#523 / MISE-005DK)
--   - restaurant_email_connections.status (#500 / MISE-005CN)
-- but left the client-readable sender_email display column unbound.
--
-- Bare POSIX [[:space:]] / [[:cntrl:]] and lower() follow database LC_CTYPE.
-- This cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; later 005* tips re-pin mailbox shape with COLLATE "C".
--
-- sender_email is the durable verified sender shown for readiness checks and
-- used to correlate the public connection row with private credentials. If
-- LC_CTYPE drifted under a missing shape gate, dump/restore could accept a
-- display From the restored C-locale credential path would refuse — or the
-- reverse — breaking Gmail reconnect continuity and supplier-send From
-- correlation across restore.
--
-- Scope:
--   - Attach restaurant_email_connections_sender_email_check as null OR
--     length 3..254, trimmed, C-locale lower, ASCII C [[:cntrl:]] rejection,
--     and [[:space:]] mailbox shape under COLLATE "C" (matches MISE-005O)
-- Does NOT rewrite service_complete_gmail_oauth / disconnect writers (#423),
-- provider vocabulary (#523), or status vocabulary (#500).
-- Timestamp after MISE-005IJ (#652).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.restaurant_email_connections'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'restaurant_email_connections_sender_email_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%sender_email%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%sender_email%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
            or pg_get_constraintdef(con.oid) ilike '%[[:space:]]%'
            or pg_get_constraintdef(con.oid) ilike '%@%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%provider%'
          and pg_get_constraintdef(con.oid) not ilike '%status%'
          and con.conname is distinct from 'restaurant_email_connections_provider_check'
          and con.conname is distinct from 'restaurant_email_connections_status_check'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.restaurant_email_connections drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.restaurant_email_connections
  drop constraint if exists restaurant_email_connections_sender_email_check;

alter table public.restaurant_email_connections
  add constraint restaurant_email_connections_sender_email_check check (
    sender_email is null
    or (
      pg_catalog.length(sender_email) between 3 and 254
      and sender_email = pg_catalog.btrim(sender_email)
      and sender_email = pg_catalog.lower(sender_email collate "C") collate "C"
      and sender_email collate "C" !~ '[[:cntrl:]]'
      and sender_email collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  );

comment on constraint restaurant_email_connections_sender_email_check
  on public.restaurant_email_connections is
  'MISE-005IK: optional sender_email length 3–254, trimmed, C-locale lower, ASCII C [[:cntrl:]] + [[:space:]] mailbox shape (COLLATE "C").';

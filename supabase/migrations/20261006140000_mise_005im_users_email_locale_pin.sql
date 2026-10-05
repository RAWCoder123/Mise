-- MISE-005IM: pin public.users.email CHECK to the durable auth-synced
-- mailbox shape under COLLATE "C".
--
-- public.users.email was declared as NOT NULL UNIQUE text with no length,
-- trim, cntrl, or mailbox-shape gate (secure multi-tenant foundation
-- 202606210001). The sole write path public.update_my_profile copies
-- auth.users.email on first profile insert and never rewrites email on
-- conflict. Sibling tips already pinned:
--   - users.name length + COLLATE C cntrl (#654 / MISE-005IL)
--   - users.preferred_locale allowlist (#463 / MISE-005CB)
--   - team candidate email normalize (#435 / MISE-005AA)
--   - restaurant_email_connections.sender_email shape (#653 / MISE-005IK)
-- but left the durable profile mailbox column unbound at the table.
--
-- Bare POSIX [[:space:]] / [[:cntrl:]] follow database LC_CTYPE. This
-- cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; later 005* tips re-pin mailbox shape with COLLATE "C".
--
-- users.email is the durable operator mailbox shown in team directory and
-- stored beside the auth identity. If LC_CTYPE drifted under a missing
-- shape gate, dump/restore could accept profile mailbox bytes the restored
-- C-locale invite-lookup / sender-email gates would refuse — or the
-- reverse — breaking team-directory and profile continuity across restore.
--
-- Scope:
--   - Attach users_email_check as length 3..254, trimmed, ASCII C
--     [[:cntrl:]] rejection, and [[:space:]] mailbox shape under
--     COLLATE "C" (no lower() requirement — Auth may preserve casing;
--     team lookup already lower()s for compare)
-- Does NOT rewrite update_my_profile, users.name (#654), preferred_locale
-- (#463), or find_restaurant_member_candidate (#435). CHECK-only.
-- Timestamp after MISE-005IL (#654).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.users'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'users_email_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%email%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%email%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
            or pg_get_constraintdef(con.oid) ilike '%[[:space:]]%'
            or pg_get_constraintdef(con.oid) ilike '%@%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%preferred_locale%'
          and pg_get_constraintdef(con.oid) not ilike '%name%'
          and pg_get_constraintdef(con.oid) not ilike '%role%'
          and con.conname is distinct from 'users_preferred_locale_allowlist_check'
          and con.conname is distinct from 'users_name_check'
          and con.conname is distinct from 'users_name_length_check'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.users drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.users
  drop constraint if exists users_email_check;

alter table public.users
  add constraint users_email_check check (
    pg_catalog.length(email) between 3 and 254
    and email = pg_catalog.btrim(email)
    and email collate "C" !~ '[[:cntrl:]]'
    and email collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  );

comment on constraint users_email_check on public.users is
  'MISE-005IM: auth-synced profile email length 3–254, trimmed, ASCII C [[:cntrl:]] + [[:space:]] mailbox shape (COLLATE "C").';
